import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  auditFindUnique: vi.fn(),
  auditFindMany: vi.fn(),
  refundsCreate: vi.fn(),
  refundsList: vi.fn(),
  opsAlert: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: h.auditCreate, findUnique: h.auditFindUnique, findMany: h.auditFindMany },
  },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ refunds: { create: h.refundsCreate, list: h.refundsList } }) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: h.opsAlert }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: h.captureMessage, captureException: vi.fn() }))

import {
  UNALLOCATED_LINE_AUDIT_ACTION,
  UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
  buildUnallocatedLineTraceRow,
  classifyRefundForCharge,
  computeUnallocatedLineRefundCents,
  isUnallocatedLineAutoRefundEnabled,
  isUnallocatedLineRefund,
  unallocatedLineAuditId,
  unallocatedLineKey,
  unallocatedLineRefundedAuditId,
  type UnallocatedLine,
} from "@/lib/unallocated-line"
import {
  alertUnattributedChargeRefund,
  loadRefundedUnallocatedLineKeys,
  loadTracedUnallocatedLinesForPaymentIntent,
  recordManualUnallocatedRefund,
  recordUnallocatedLines,
  writeUnallocatedTracesInTransaction,
} from "@/lib/unallocated-line.server"

const session = {
  id: "cs_test_1",
  currency: "eur",
  payment_intent: "pi_1",
  amount_total: 12_000,
  amount_subtotal: 10_000,
  total_details: { amount_tax: 2_000 },
} as never

const line = (over: Partial<UnallocatedLine> = {}): UnallocatedLine => ({
  lineIndex: 1,
  reason: "listing_inactive",
  affiliateProductId: "ap_1",
  productId: "p_1",
  qty: 2,
  paidLineCents: 5_000,
  ...over,
})

const rowsOf = (action: string) => h.auditCreate.mock.calls.filter((c) => c[0].data.action === action)
const traceRows = () => rowsOf(UNALLOCATED_LINE_AUDIT_ACTION)

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.UNALLOCATED_LINE_AUTO_REFUND
  delete process.env.SENTRY_DSN
  h.auditCreate.mockResolvedValue({})
  h.auditFindUnique.mockResolvedValue(null)
  h.auditFindMany.mockResolvedValue([])
  h.opsAlert.mockResolvedValue({ slack: true, discord: false })
  h.refundsCreate.mockResolvedValue({ id: "re_1" })
  h.refundsList.mockResolvedValue({ data: [] })
})

describe("pure helpers", () => {
  it("keys and audit ids are deterministic", () => {
    expect(unallocatedLineKey("cs_1", 2)).toBe("cs_1:line:2")
    expect(unallocatedLineAuditId("cs_1:line:2")).toBe("unallocated-line:cs_1:line:2")
    expect(unallocatedLineRefundedAuditId("cs_1:line:2")).toBe("unallocated-line-refunded:cs_1:line:2")
  })

  it("the automatic refund is OFF by default and only the exact word `true` turns it on", () => {
    expect(isUnallocatedLineAutoRefundEnabled({})).toBe(false)
    for (const v of ["", "1", "TRUE", "yes", "on", "false", "True"]) {
      expect(isUnallocatedLineAutoRefundEnabled({ UNALLOCATED_LINE_AUTO_REFUND: v })).toBe(false)
    }
    expect(isUnallocatedLineAutoRefundEnabled({ UNALLOCATED_LINE_AUTO_REFUND: " true " })).toBe(true)
  })

  it("refund amount = what the line collected + its share of the VAT, capped at the session", () => {
    // 5 000 HT of a 10 000 HT checkout with 2 000 VAT: 5 000 + 1 000
    expect(
      computeUnallocatedLineRefundCents({ paidLineCents: 5_000, checkoutSubtotalCents: 10_000, checkoutTaxCents: 2_000, checkoutAmountTotalCents: 12_000 })
    ).toBe(6_000)
    // no VAT
    expect(
      computeUnallocatedLineRefundCents({ paidLineCents: 5_000, checkoutSubtotalCents: 10_000, checkoutTaxCents: 0, checkoutAmountTotalCents: 10_000 })
    ).toBe(5_000)
    // never above what the session collected
    expect(
      computeUnallocatedLineRefundCents({ paidLineCents: 99_999, checkoutSubtotalCents: 10_000, checkoutTaxCents: 0, checkoutAmountTotalCents: 10_000 })
    ).toBe(10_000)
    // unknown amount: nothing can be refunded
    expect(
      computeUnallocatedLineRefundCents({ paidLineCents: null, checkoutSubtotalCents: 10_000, checkoutTaxCents: 0, checkoutAmountTotalCents: 10_000 })
    ).toBeNull()
  })

  it("recognises the refund it created by its metadata only", () => {
    expect(isUnallocatedLineRefund({ metadata: { affisell_unallocated_line: "1" } })).toBe(true)
    expect(isUnallocatedLineRefund({ metadata: { orderId: "o1" } })).toBe(false)
    expect(isUnallocatedLineRefund({ metadata: null })).toBe(false)
    expect(isUnallocatedLineRefund({})).toBe(false)
  })
})

describe("recordUnallocatedLines — trace + alert (refund disabled by default)", () => {
  it("writes ONE durable trace with a deterministic id, alerts once, and moves no money", async () => {
    const out = await recordUnallocatedLines({ session, lines: [line()], appliedRewardCents: 300 })

    expect(out).toEqual([{ key: "cs_test_1:line:1", trace: "created", refund: "disabled" }])
    expect(traceRows()).toHaveLength(1)
    // …and the alert is marked sent by its own deterministic row (the trace is written before the response, the alert after)
    expect(rowsOf("payment.unallocated_line.alerted")).toHaveLength(1)
    expect(rowsOf("payment.unallocated_line.alerted")[0]![0].data.id).toBe("unallocated-line-alerted:cs_test_1:line:1")
    const data = traceRows()[0]![0].data
    expect(data).toMatchObject({
      id: "unallocated-line:cs_test_1:line:1",
      action: UNALLOCATED_LINE_AUDIT_ACTION,
      entityType: "StripeCheckoutLine",
      entityId: "cs_test_1:line:1",
      payload: expect.objectContaining({
        checkoutSessionId: "cs_test_1",
        lineIndex: 1,
        reason: "listing_inactive",
        paidLineCents: 5_000,
        refundableCents: 6_000,
        appliedRewardCents: 300,
        autoRefundEnabled: false,
        paymentIntentId: "pi_1",
      }),
    })
    expect(h.opsAlert).toHaveBeenCalledTimes(1)
    expect(h.opsAlert.mock.calls[0]![0]).toContain("UNALLOCATED_LINE")
    expect(h.opsAlert.mock.calls[0]![0]).toContain("reason=listing_inactive")
    expect(h.opsAlert.mock.calls[0]![0]).toContain("auto_refund=off")
    // a refund made by hand is recognised by its exact amount: the alert says which one
    expect(h.opsAlert.mock.calls[0]![0]).toContain("Refund EXACTLY 60.00 EUR")
    expect(h.opsAlert.mock.calls[0]![0]).toContain("payment_intent=pi_1")
    // Real money must never move unless the flag is set.
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it("also reports to Sentry when a DSN is configured", async () => {
    process.env.SENTRY_DSN = "https://example.invalid/1"
    await recordUnallocatedLines({ session, lines: [line()] })
    expect(h.captureMessage).toHaveBeenCalledTimes(1)
    expect(h.captureMessage.mock.calls[0]![0]).toContain("UNALLOCATED_LINE")
  })

  it("is idempotent: a replay finds the trace (unique id) and the 'alerted' mark, alerts nobody again", async () => {
    h.auditCreate.mockRejectedValueOnce(uniqueViolation())
    h.auditFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id.startsWith("unallocated-line-alerted:") ? { id: where.id } : null
    )
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "existing", refund: "disabled" })
    expect(h.opsAlert).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it("a trace written INSIDE the fulfilment transaction (the row already exists) but never alerted: the next pass alerts, once", async () => {
    h.auditCreate.mockRejectedValueOnce(uniqueViolation()) // the in-transaction write got there first
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "existing" })
    expect(h.opsAlert).toHaveBeenCalledTimes(1)
    expect(rowsOf("payment.unallocated_line.alerted")).toHaveLength(1)
  })

  it("still alerts when the trace itself can not be written, and never throws", async () => {
    h.auditCreate.mockRejectedValueOnce(new Error("db down"))
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "failed", refund: "disabled" })
    expect(h.opsAlert).toHaveBeenCalledTimes(1)
  })

  it("an alert channel being down does not break the flow", async () => {
    h.opsAlert.mockRejectedValue(new Error("slack down"))
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "created" })
  })

  it("handles every line on its own: a failing line never stops the next one", async () => {
    h.auditCreate.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({})
    h.opsAlert.mockRejectedValueOnce(new Error("slack down")).mockResolvedValue({})
    const out = await recordUnallocatedLines({
      session,
      lines: [line({ lineIndex: 0 }), line({ lineIndex: 2, reason: "insufficient_stock", detail: { available: 0, requested: 2 } })],
    })
    expect(out.map((o) => o.key)).toEqual(["cs_test_1:line:0", "cs_test_1:line:2"])
    expect(traceRows()).toHaveLength(2)
    expect(traceRows()[1]![0].data.payload).toMatchObject({
      reason: "insufficient_stock",
      detail: { available: 0, requested: 2 },
    })
  })
})

describe("recordUnallocatedLines — automatic refund, only with UNALLOCATED_LINE_AUTO_REFUND=true", () => {
  beforeEach(() => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
  })

  it("refunds the line (partial, VAT included) on the payment intent, idempotently, and leaves the proof", async () => {
    const out = await recordUnallocatedLines({ session, lines: [line()] })

    expect(out[0]).toEqual({ key: "cs_test_1:line:1", trace: "created", refund: "refunded", stripeRefundId: "re_1" })
    expect(h.refundsCreate).toHaveBeenCalledTimes(1)
    const [params, opts] = h.refundsCreate.mock.calls[0]!
    expect(params).toMatchObject({
      payment_intent: "pi_1",
      amount: 6_000,
      reason: "requested_by_customer",
      metadata: expect.objectContaining({
        affisell_unallocated_line: "1",
        checkoutSessionId: "cs_test_1",
        lineIndex: "1",
        reasonCode: "listing_inactive",
      }),
    })
    expect(opts).toEqual({ idempotencyKey: "unallocated-line-refund:cs_test_1:line:1" })
    // the refunded row is the proof that this line went back to the buyer
    expect(rowsOf(UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION)).toHaveLength(1)
    expect(rowsOf(UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION)[0]![0].data).toMatchObject({
      id: "unallocated-line-refunded:cs_test_1:line:1",
      action: UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
      payload: expect.objectContaining({ stripeRefundId: "re_1", amountCents: 6_000 }),
    })
    expect(h.opsAlert).toHaveBeenCalledTimes(2) // the line, then "refunded"
  })

  it("never refunds twice: a line already refunded is left alone", async () => {
    h.auditFindUnique.mockResolvedValue({ id: "unallocated-line-refunded:cs_test_1:line:1" })
    h.auditCreate.mockRejectedValueOnce(uniqueViolation())
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "existing", refund: "already_refunded" })
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it("does not refund what it can not size, or a payment it can not find", async () => {
    const unknownAmount = await recordUnallocatedLines({ session, lines: [line({ paidLineCents: null })] })
    expect(unknownAmount[0]!.refund).toBe("no_amount")
    const noPi = await recordUnallocatedLines({ session: { ...(session as object), payment_intent: null } as never, lines: [line()] })
    expect(noPi[0]!.refund).toBe("no_payment_intent")
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it("accepts an expanded payment_intent object", async () => {
    await recordUnallocatedLines({ session: { ...(session as object), payment_intent: { id: "pi_obj" } } as never, lines: [line()] })
    expect(h.refundsCreate.mock.calls[0]![0].payment_intent).toBe("pi_obj")
  })

  it("a refused refund is reported (alert), leaves no `refunded` proof and does not stop the next line", async () => {
    h.refundsCreate.mockRejectedValueOnce(new Error("charge_already_refunded")).mockResolvedValue({ id: "re_2" })
    const out = await recordUnallocatedLines({
      session,
      lines: [line({ lineIndex: 0 }), line({ lineIndex: 1 })],
    })
    expect(out.map((o) => o.refund)).toEqual(["failed", "refunded"])
    expect(h.opsAlert.mock.calls.some((c) => String(c[0]).includes("automatic refund FAILED"))).toBe(true)
    const refundedRows = h.auditCreate.mock.calls.filter((c) => c[0].data.action === UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION)
    expect(refundedRows).toHaveLength(1)
    expect(refundedRows[0]![0].data.entityId).toBe("cs_test_1:line:1")
  })
})

describe("loadRefundedUnallocatedLineKeys", () => {
  it("returns the lines that already went back to the buyer", async () => {
    h.auditFindMany.mockResolvedValue([{ id: "unallocated-line-refunded:cs_1:line:1" }])
    const keys = await loadRefundedUnallocatedLineKeys(["cs_1:line:0", "cs_1:line:1"])
    expect([...keys]).toEqual(["cs_1:line:1"])
    expect(h.auditFindMany.mock.calls[0]![0].where.id.in).toEqual([
      "unallocated-line-refunded:cs_1:line:0",
      "unallocated-line-refunded:cs_1:line:1",
    ])
  })

  it("never throws: an unreadable trace must not block the payment processing", async () => {
    h.auditFindMany.mockRejectedValue(new Error("table missing"))
    await expect(loadRefundedUnallocatedLineKeys(["cs_1:line:0"])).resolves.toEqual(new Set())
    await expect(loadRefundedUnallocatedLineKeys([])).resolves.toEqual(new Set())
  })
})

describe("automatic refund — what the payment already carries", () => {
  beforeEach(() => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
  })

  it("a refund created earlier for this very line (proof row lost, idempotency key expired) is reused, not repeated", async () => {
    h.refundsList.mockResolvedValue({
      data: [
        { id: "re_other", amount: 100, status: "succeeded", metadata: { orderId: "o1" } },
        {
          id: "re_held",
          amount: 6_000,
          status: "succeeded",
          metadata: { affisell_unallocated_line: "1", checkoutSessionId: "cs_test_1", lineIndex: "1" },
        },
      ],
    })
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ refund: "already_refunded", stripeRefundId: "re_held" })
    expect(h.refundsCreate).not.toHaveBeenCalled()
    const proof = h.auditCreate.mock.calls.find((c) => c[0].data.action === UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION)
    expect(proof![0].data.payload).toMatchObject({ stripeRefundId: "re_held", source: "automatic_recovered" })
  })

  it("a failed or cancelled refund of that line does not count", async () => {
    h.refundsList.mockResolvedValue({
      data: [{ id: "re_bad", amount: 6_000, status: "failed", metadata: { affisell_unallocated_line: "1", checkoutSessionId: "cs_test_1", lineIndex: "1" } }],
    })
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ refund: "refunded" })
    expect(h.refundsCreate).toHaveBeenCalledTimes(1)
  })

  it("an unreadable refund list never blocks the refund (the idempotency key still protects it)", async () => {
    h.refundsList.mockRejectedValue(new Error("stripe down"))
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ refund: "refunded" })
  })
})

describe("classifyRefundForCharge — whom a refund of the charge belongs to", () => {
  const traced = [
    { key: "cs_1:line:1", refundableCents: 2_000, refundedByRefundId: null },
  ]
  const classify = (refund: { id: string; amount: number; metadata?: Record<string, string> | null }, over: Record<string, unknown> = {}) =>
    classifyRefundForCharge({ refund, tracedLines: traced, orderChargedTotalsCents: [1_000], ...over } as never)

  it("a charge with NO traced line behaves exactly as before: every unmarked refund is an order refund", () => {
    expect(classifyRefundForCharge({ refund: { id: "re_1", amount: 2_000 }, tracedLines: [], orderChargedTotalsCents: [1_000] })).toEqual({ kind: "order" })
  })

  it("the marker of the automatic refund wins, with or without trace", () => {
    const refund = { id: "re_1", amount: 2_000, metadata: { affisell_unallocated_line: "1", checkoutSessionId: "cs_9", lineIndex: "3" } }
    expect(classifyRefundForCharge({ refund, tracedLines: [], orderChargedTotalsCents: [] })).toEqual({ kind: "unallocated", lineKey: "cs_9:line:3", via: "marker" })
    expect(classify(refund)).toMatchObject({ kind: "unallocated", via: "marker" })
  })

  it("a MANUAL refund of exactly the traced amount belongs to the traced line (not to the sibling order)", () => {
    expect(classify({ id: "re_manual", amount: 2_000, metadata: {} })).toEqual({ kind: "unallocated", lineKey: "cs_1:line:1", via: "amount" })
  })

  it("a refund id already recorded on a line is that line's, on every replay", () => {
    const recorded = [{ key: "cs_1:line:1", refundableCents: 2_000, refundedByRefundId: "re_manual" }]
    expect(classifyRefundForCharge({ refund: { id: "re_manual", amount: 2_000 }, tracedLines: recorded, orderChargedTotalsCents: [1_000] })).toEqual({
      kind: "unallocated",
      lineKey: "cs_1:line:1",
      via: "recorded",
    })
    // a SECOND bare refund can no longer claim the already refunded line: with every line refunded it can only be an order's
    expect(classifyRefundForCharge({ refund: { id: "re_second", amount: 2_000 }, tracedLines: recorded, orderChargedTotalsCents: [1_000] })).toEqual({ kind: "order" })
  })

  it("a refund that NAMES an order is that order's, even when a line is traced", () => {
    expect(classify({ id: "re_a", amount: 300, metadata: { orderId: "A" } })).toEqual({ kind: "order" })
  })

  it("an amount that is also an order's charged total is ambiguous: never guessed", () => {
    expect(classify({ id: "re_x", amount: 2_000, metadata: {} }, { orderChargedTotalsCents: [2_000] })).toEqual({ kind: "ambiguous" })
  })

  it("while a line is still owed, a bare PARTIAL refund could be either: ambiguous (not applied to the sibling order)", () => {
    expect(classify({ id: "re_x", amount: 500, metadata: {} })).toEqual({ kind: "ambiguous" })
    // the dashboard's default amount: the whole charge (order 1 000 + owed line 2 000)
    expect(classify({ id: "re_x", amount: 3_000, metadata: null })).toEqual({ kind: "ambiguous" })
  })

  it("two identical lines are claimed one refund each, never twice", () => {
    const two = [
      { key: "cs_1:line:1", refundableCents: 2_000, refundedByRefundId: null },
      { key: "cs_1:line:2", refundableCents: 2_000, refundedByRefundId: null },
    ]
    const claimed = new Set<string>()
    const a = classifyRefundForCharge({ refund: { id: "r1", amount: 2_000 }, tracedLines: two, orderChargedTotalsCents: [], claimed })
    const b = classifyRefundForCharge({ refund: { id: "r2", amount: 2_000 }, tracedLines: two, orderChargedTotalsCents: [], claimed })
    const c = classifyRefundForCharge({ refund: { id: "r3", amount: 2_000 }, tracedLines: two, orderChargedTotalsCents: [], claimed })
    // once both lines are claimed nothing is left to be ambiguous about: the third refund can only concern an order
    expect([a, b, c].map((x) => (x.kind === "unallocated" ? x.lineKey : x.kind))).toEqual(["cs_1:line:1", "cs_1:line:2", "order"])
  })
})

describe("reading the trace back for a charge", () => {
  it("finds the traced lines of a payment intent and which of them are already refunded", async () => {
    h.auditFindMany
      .mockResolvedValueOnce([
        { entityId: "cs_1:line:1", payload: { refundableCents: 2_000, paymentIntentId: "pi_1" } },
        { entityId: "cs_1:line:2", payload: { refundableCents: null } },
      ])
      .mockResolvedValueOnce([{ entityId: "cs_1:line:2", payload: { stripeRefundId: "re_9" } }])
    const lines = await loadTracedUnallocatedLinesForPaymentIntent("pi_1")
    expect(lines).toEqual([
      { key: "cs_1:line:1", refundableCents: 2_000, refundedByRefundId: null },
      { key: "cs_1:line:2", refundableCents: null, refundedByRefundId: "re_9" },
    ])
    expect(h.auditFindMany.mock.calls[0]![0].where).toEqual({
      action: UNALLOCATED_LINE_AUDIT_ACTION,
      payload: { path: ["paymentIntentId"], equals: "pi_1" },
    })
  })

  it("nothing traced: one read, no second one", async () => {
    h.auditFindMany.mockResolvedValue([])
    await expect(loadTracedUnallocatedLinesForPaymentIntent("pi_1")).resolves.toEqual([])
    expect(h.auditFindMany).toHaveBeenCalledTimes(1)
  })

  it("a database error is NOT swallowed here: the webhook must fail and be replayed rather than guess", async () => {
    h.auditFindMany.mockRejectedValue(new Error("db down"))
    await expect(loadTracedUnallocatedLinesForPaymentIntent("pi_1")).rejects.toThrow("db down")
  })

  it("records a manual refund as the line's proof (source manual) and tells ops it was matched by amount", async () => {
    await recordManualUnallocatedRefund({ lineKey: "cs_1:line:1", stripeRefundId: "re_m", amountCents: 2_000, currency: "eur" })
    expect(h.auditCreate.mock.calls[0]![0].data).toMatchObject({
      id: "unallocated-line-refunded:cs_1:line:1",
      action: UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
      entityId: "cs_1:line:1",
      payload: { checkoutSessionId: "cs_1", lineIndex: 1, stripeRefundId: "re_m", source: "manual_dashboard" },
    })
    expect(h.opsAlert.mock.calls[0]![0]).toContain("recognised by its amount")
  })

  it("a refund that can not be attributed raises an alert and touches nothing else", async () => {
    await alertUnattributedChargeRefund({ chargeId: "ch_1", stripeRefundId: "re_x", amountCents: 500 })
    expect(h.opsAlert.mock.calls[0]![0]).toContain("NOT applied to any order")
    expect(h.auditCreate).not.toHaveBeenCalled()
  })
})

describe("classifyRefundForCharge — bare (dashboard) refunds, table (#1: a refund that can only concern the remaining order is NOT dropped)", () => {
  type Line = { key: string; refundableCents: number | null; refundedByRefundId: string | null }
  const owed = (key: string, cents: number | null): Line => ({ key, refundableCents: cents, refundedByRefundId: null })
  const done = (key: string, cents: number, by: string): Line => ({ key, refundableCents: cents, refundedByRefundId: by })
  const bare = (amount: number) => ({ id: `re_${amount}`, amount, metadata: {} })

  const table: Array<{ name: string; lines: Line[]; orders: number[]; amount: number; expected: "order" | "ambiguous" | "unallocated" }> = [
    // the common follow-up: the lost line was refunded, support then refunds the remaining order by hand
    { name: "S1: line refunded, the whole order refunded", lines: [done("c:line:1", 5_000, "re_C")], orders: [10_000], amount: 10_000, expected: "order" },
    { name: "S1b: line refunded, a partial refund of the order", lines: [done("c:line:1", 5_000, "re_C")], orders: [10_000], amount: 3_000, expected: "order" },
    { name: "line refunded, an amount that equals the line's own", lines: [done("c:line:1", 5_000, "re_C")], orders: [10_000], amount: 5_000, expected: "order" },
    { name: "every line refunded, several of them", lines: [done("c:line:1", 5_000, "re_C"), done("c:line:2", 2_000, "re_D")], orders: [10_000], amount: 7_777, expected: "order" },
    // a line is still owed
    { name: "owed line, a refund of exactly its amount", lines: [owed("c:line:1", 5_000)], orders: [10_000], amount: 5_000, expected: "unallocated" },
    { name: "owed line, a refund of exactly the order's total (and no line's)", lines: [owed("c:line:1", 5_000)], orders: [10_000], amount: 10_000, expected: "order" },
    { name: "S2: owed line, the dashboard's whole-charge default", lines: [owed("c:line:1", 5_000)], orders: [10_000], amount: 15_000, expected: "ambiguous" },
    { name: "owed line, a partial refund of the order", lines: [owed("c:line:1", 5_000)], orders: [10_000], amount: 3_000, expected: "ambiguous" },
    { name: "owed line, an amount bigger than the order and smaller than the charge", lines: [owed("c:line:1", 5_000)], orders: [10_000], amount: 12_000, expected: "ambiguous" },
    { name: "the amount is both an owed line's and an order's total", lines: [owed("c:line:1", 10_000)], orders: [10_000], amount: 10_000, expected: "ambiguous" },
    { name: "an owed line of unknown amount: only an exact order total could be told apart, and it can not", lines: [owed("c:line:1", null)], orders: [10_000], amount: 10_000, expected: "ambiguous" },
    { name: "two owed lines refunded together equal an order's total: lines, not the order", lines: [owed("c:line:1", 4_000), owed("c:line:2", 6_000)], orders: [10_000], amount: 10_000, expected: "ambiguous" },
    { name: "one owed, one refunded line: an order-sized refund is the order's", lines: [owed("c:line:1", 4_000), done("c:line:2", 6_000, "re_D")], orders: [10_000], amount: 10_000, expected: "order" },
    { name: "no open order at all (every order closed) and a line still owed", lines: [owed("c:line:1", 5_000)], orders: [], amount: 3_000, expected: "ambiguous" },
  ]
  for (const row of table) {
    it(row.name, () => {
      const res = classifyRefundForCharge({ refund: bare(row.amount), tracedLines: row.lines, orderChargedTotalsCents: row.orders })
      expect(res.kind).toBe(row.expected)
    })
  }

  it("never attributes a refund to the sibling order while something could still be a line refund (no refund of the table above both applies and is ambiguous)", () => {
    for (const row of table.filter((r) => r.expected === "ambiguous")) {
      const res = classifyRefundForCharge({ refund: bare(row.amount), tracedLines: row.lines, orderChargedTotalsCents: row.orders })
      expect(res.kind, row.name).not.toBe("order")
    }
  })
})

describe("the trace row (one builder for the in-transaction and the after-response write)", () => {
  it("is deterministic and carries what the refund handler and ops need", () => {
    const row = buildUnallocatedLineTraceRow({ session: session as never, line: line(), appliedRewardCents: 300, autoRefundEnabled: false })
    expect(row).toMatchObject({
      id: "unallocated-line:cs_test_1:line:1",
      action: UNALLOCATED_LINE_AUDIT_ACTION,
      entityType: "StripeCheckoutLine",
      entityId: "cs_test_1:line:1",
      payload: { reason: "listing_inactive", refundableCents: 6_000, paymentIntentId: "pi_1", appliedRewardCents: 300, currency: "eur" },
    })
    expect(buildUnallocatedLineTraceRow({ session: session as never, line: line(), appliedRewardCents: 300, autoRefundEnabled: false })).toEqual(row)
  })

  it("is written inside a transaction with createMany + skipDuplicates (never by catching a unique violation)", async () => {
    const createMany = vi.fn(async () => ({ count: 1 }))
    await writeUnallocatedTracesInTransaction({ auditLog: { createMany } } as never, {
      session: session as never,
      lines: [line({ lineIndex: 0 }), line({ lineIndex: 2 })],
      appliedRewardCents: 100,
    })
    expect(createMany).toHaveBeenCalledTimes(1)
    const arg = (createMany.mock.calls[0] as unknown as [{ data: Array<{ id: string }>; skipDuplicates: boolean }])[0]
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data.map((d) => d.id)).toEqual(["unallocated-line:cs_test_1:line:0", "unallocated-line:cs_test_1:line:2"])
    // nothing to write: no statement at all
    createMany.mockClear()
    await writeUnallocatedTracesInTransaction({ auditLog: { createMany } } as never, { session: session as never, lines: [] })
    expect(createMany).not.toHaveBeenCalled()
  })
})
