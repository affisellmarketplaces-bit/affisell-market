import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  auditFindUnique: vi.fn(),
  auditFindMany: vi.fn(),
  refundsCreate: vi.fn(),
  opsAlert: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: h.auditCreate, findUnique: h.auditFindUnique, findMany: h.auditFindMany },
  },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ refunds: { create: h.refundsCreate } }) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: h.opsAlert }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: h.captureMessage, captureException: vi.fn() }))

import {
  UNALLOCATED_LINE_AUDIT_ACTION,
  UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
  computeUnallocatedLineRefundCents,
  isUnallocatedLineAutoRefundEnabled,
  isUnallocatedLineRefund,
  unallocatedLineAuditId,
  unallocatedLineKey,
  unallocatedLineRefundedAuditId,
  type UnallocatedLine,
} from "@/lib/unallocated-line"
import { loadRefundedUnallocatedLineKeys, recordUnallocatedLines } from "@/lib/unallocated-line.server"

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
    expect(h.auditCreate).toHaveBeenCalledTimes(1)
    const data = h.auditCreate.mock.calls[0]![0].data
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
    // Real money must never move unless the flag is set.
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it("also reports to Sentry when a DSN is configured", async () => {
    process.env.SENTRY_DSN = "https://example.invalid/1"
    await recordUnallocatedLines({ session, lines: [line()] })
    expect(h.captureMessage).toHaveBeenCalledTimes(1)
    expect(h.captureMessage.mock.calls[0]![0]).toContain("UNALLOCATED_LINE")
  })

  it("is idempotent: a replay finds the trace (unique id), alerts nobody again", async () => {
    h.auditCreate.mockRejectedValueOnce(uniqueViolation())
    const out = await recordUnallocatedLines({ session, lines: [line()] })
    expect(out[0]).toMatchObject({ trace: "existing", refund: "disabled" })
    expect(h.opsAlert).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
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
    expect(h.auditCreate).toHaveBeenCalledTimes(2)
    expect(h.auditCreate.mock.calls[1]![0].data.payload).toMatchObject({
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
    // the second audit row is the proof that this line went back to the buyer
    expect(h.auditCreate).toHaveBeenCalledTimes(2)
    expect(h.auditCreate.mock.calls[1]![0].data).toMatchObject({
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
