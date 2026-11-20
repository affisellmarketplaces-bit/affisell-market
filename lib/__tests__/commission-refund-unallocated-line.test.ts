/**
 * D6 follow-up: the automatic refund of an unallocated line (`lib/unallocated-line.server.ts`) lands on the SAME Stripe
 * charge as the orders of the other lines. The `charge.refunded` handler must not attribute it to one of them: a lone
 * remaining order would look "fully refunded" (payouts clawed back, buyer told his valid order was cancelled).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = {
  id: string
  status?: string
  totalCents: number
  subtotalCents: number
  sellingPriceCents: number
  taxCents: number
  platformCommissionCents: number
  paymentSettlementStatus: string
}
const { orders, audit, opsAlert, recordedRefunds, orderUpdates, reverse, clawbackFull, clawbackPartial, notifyCancelled } = vi.hoisted(() => ({
  orders: {} as Record<string, Row>,
  audit: new Map<string, { id: string; action: string; entityId: string | null; payload: Record<string, unknown> }>(),
  opsAlert: vi.fn(async (_text: string) => ({ slack: false, discord: false })),
  recordedRefunds: [] as Array<{ orderId: string; stripeRefundId: string; amountCents: number }>,
  orderUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  reverse: vi.fn(async () => ({})),
  clawbackFull: vi.fn(async () => ({ executed: true })),
  clawbackPartial: vi.fn(async () => ({})),
  notifyCancelled: vi.fn(async () => {}),
}))

vi.mock("@/lib/emails/notify-order-cancelled", () => ({ notifyOrderCancelled: notifyCancelled }))
vi.mock("@/lib/sponsor/charge-sponsor-on-sale", () => ({ reverseSponsorSuccessFeesForOrder: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-transfer-reversal", () => ({ reverseConnectTransfersForRefund: reverse }))
vi.mock("@/lib/order-payout", () => ({
  clawbackOrderPayoutsOnPartialRefund: clawbackPartial,
  clawbackOrderPayoutsOnRefund: clawbackFull,
}))
vi.mock("@/lib/payout-reversal-safety", () => ({
  alertClawbackBlocked: vi.fn(),
  evaluateClawbackSafety: async () => ({ allowed: true }),
  markRefundPendingClawback: vi.fn(async () => {}),
}))
vi.mock("@/lib/fulfillment/external-order-cancellation", () => ({ attemptExternalOrderCancellation: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ checkout: { sessions: { list: async () => ({ data: [{ id: "cs_1" }] }) } } }),
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: opsAlert }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: async () => Object.values(orders).map((o) => ({ id: o.id })),
      findUnique: async ({ where }: { where: { id: string } }) => orders[where.id] ?? null,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        orderUpdates.push({ id: args.where.id, data: args.data })
        return {}
      },
    },
    auditLog: {
      findMany: async ({ where }: { where: { id?: { in: string[] }; action?: string; payload?: { path: string[]; equals: unknown } } }) =>
        [...audit.values()].filter((r) => {
          if (where.id && !where.id.in.includes(r.id)) return false
          if (where.action && r.action !== where.action) return false
          if (where.payload && (r.payload as Record<string, unknown>)[where.payload.path[0]!] !== where.payload.equals) return false
          return true
        }),
      create: async ({ data }: { data: { id: string; action: string; entityId: string | null; payload: Record<string, unknown> } }) => {
        if (audit.has(data.id)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
        audit.set(data.id, data)
        return data
      },
    },
    orderStripeRefund: {
      findUnique: async ({ where }: { where: { stripeRefundId: string } }) =>
        recordedRefunds.find((r) => r.stripeRefundId === where.stripeRefundId) ?? null,
      create: async ({ data }: { data: { orderId: string; stripeRefundId: string; amountCents: number } }) => {
        recordedRefunds.push(data)
        return data
      },
    },
  },
}))

import { handleStripeChargeRefundedWithCommission } from "@/lib/stripe-commission-refund"

const row = (id: string, total: number): Row => ({
  id,
  totalCents: total,
  subtotalCents: total,
  sellingPriceCents: total,
  taxCents: 0,
  platformCommissionCents: 0,
  paymentSettlementStatus: "PAID",
})

type R = { id: string; amount: number; orderId?: string; unallocated?: boolean }
function charge(refunds: R[], amountRefunded: number, amount = 3000) {
  return {
    id: "ch_1",
    amount,
    currency: "eur",
    payment_intent: "pi_1",
    amount_refunded: amountRefunded,
    refunds: {
      data: refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: null,
        metadata: {
          ...(r.orderId ? { orderId: r.orderId } : {}),
          ...(r.unallocated ? { affisell_unallocated_line: "1", source: "unallocated_line" } : {}),
        },
      })),
    },
  } as never
}

describe("refund of an unallocated line on a charge that also carries a valid order (A 10 €; lost line 20 €)", () => {
  beforeEach(() => {
    for (const k of Object.keys(orders)) delete orders[k]
    orders.A = row("A", 1000)
    recordedRefunds.length = 0
    orderUpdates.length = 0
    reverse.mockClear()
    clawbackFull.mockClear()
    clawbackPartial.mockClear()
    notifyCancelled.mockClear()
  })

  it("leaves the valid order completely untouched (no clawback, no 'refunded', no buyer cancellation e-mail)", async () => {
    const res = await handleStripeChargeRefundedWithCommission(
      charge([{ id: "re_lost", amount: 2000, unallocated: true }], 2000)
    )
    expect(res.processedOrderIds).toEqual([])
    expect(recordedRefunds).toEqual([])
    expect(reverse).not.toHaveBeenCalled()
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(clawbackPartial).not.toHaveBeenCalled()
    expect(orderUpdates).toEqual([])
    expect(notifyCancelled).not.toHaveBeenCalled()
  })

  it("a genuine partial refund of the order is judged on ITS OWN refunds, not on the charge total", async () => {
    await handleStripeChargeRefundedWithCommission(
      charge(
        [
          { id: "re_lost", amount: 2000, unallocated: true },
          { id: "re_A", amount: 300 },
        ],
        2300
      )
    )
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A", amountCents: 300 })])
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(orderUpdates.find((u) => u.id === "A")?.data).toEqual({ paymentSettlementStatus: "PARTIALLY_REFUNDED" })
  })

  it("a genuine FULL refund of the order is still recognised as full", async () => {
    await handleStripeChargeRefundedWithCommission(
      charge(
        [
          { id: "re_lost", amount: 2000, unallocated: true },
          { id: "re_A", amount: 1000 },
        ],
        3000
      )
    )
    expect(clawbackFull).toHaveBeenCalledTimes(1)
    expect(orderUpdates.find((u) => u.id === "A")?.data).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED" })
  })

  it("on a multi-order charge the unallocated refund is ignored and a refund naming an order still applies", async () => {
    orders.B = row("B", 1000)
    await handleStripeChargeRefundedWithCommission(
      charge(
        [
          { id: "re_lost", amount: 2000, unallocated: true },
          { id: "re_B", amount: 1000, orderId: "B" },
        ],
        3000
      )
    )
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "B", stripeRefundId: "re_B" })])
    expect(orderUpdates.some((u) => u.id === "A")).toBe(false)
    expect(clawbackFull).toHaveBeenCalledTimes(1)
  })

  it("charges without any unallocated refund behave exactly as before (a sole order refunded in full is full)", async () => {
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 1000 }], 1000, 1000))
    expect(clawbackFull).toHaveBeenCalledTimes(1)
    expect(orderUpdates.find((u) => u.id === "A")?.data).toMatchObject({ status: "refunded" })
  })
})

describe("MANUAL refund (Stripe dashboard — no marker, no order id) of an unallocated line", () => {
  const traceLine = (key: string, refundableCents: number, over: Record<string, unknown> = {}) =>
    audit.set(`unallocated-line:${key}`, {
      id: `unallocated-line:${key}`,
      action: "payment.unallocated_line",
      entityId: key,
      payload: { paymentIntentId: "pi_1", refundableCents, ...over },
    })

  beforeEach(() => {
    for (const k of Object.keys(orders)) delete orders[k]
    audit.clear()
    recordedRefunds.length = 0
    orderUpdates.length = 0
    reverse.mockClear()
    clawbackFull.mockClear()
    clawbackPartial.mockClear()
    notifyCancelled.mockClear()
    opsAlert.mockClear()
    orders.A = row("A", 1000)
    traceLine("cs_1:line:1", 2000) // the lost line: 20 EUR, paid on the same charge as order A (10 EUR)
  })

  it("is recognised by its exact amount: the valid sibling order is NOT touched, the line gets its proof, ops are told", async () => {
    const res = await handleStripeChargeRefundedWithCommission(charge([{ id: "re_manual", amount: 2000 }], 2000))

    expect(res.processedOrderIds).toEqual([])
    expect(recordedRefunds).toEqual([])
    expect(reverse).not.toHaveBeenCalled()
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(clawbackPartial).not.toHaveBeenCalled()
    expect(orderUpdates).toEqual([])
    expect(notifyCancelled).not.toHaveBeenCalled()
    expect(audit.get("unallocated-line-refunded:cs_1:line:1")).toMatchObject({
      payload: { stripeRefundId: "re_manual", amountCents: 2000, source: "manual_dashboard" },
    })
    expect(opsAlert.mock.calls.some((c) => String(c[0]).includes("recognised by its amount"))).toBe(true)
  })

  it("a webhook replay does not record it twice nor touch the order", async () => {
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_manual", amount: 2000 }], 2000))
    const auditSize = audit.size
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_manual", amount: 2000 }], 2000))
    expect(audit.size).toBe(auditSize)
    expect(orderUpdates).toEqual([])
    expect(clawbackFull).not.toHaveBeenCalled()
  })

  it("a bare refund of ANOTHER amount is attributed to nothing (it used to partially refund the sibling order): ops are alerted", async () => {
    const res = await handleStripeChargeRefundedWithCommission(charge([{ id: "re_x", amount: 500 }], 500))
    expect(res.processedOrderIds).toEqual([])
    expect(recordedRefunds).toEqual([])
    expect(orderUpdates).toEqual([])
    expect(clawbackPartial).not.toHaveBeenCalled()
    expect(audit.has("unallocated-line-refunded:cs_1:line:1")).toBe(false)
    expect(opsAlert.mock.calls.some((c) => String(c[0]).includes("NOT applied to any order"))).toBe(true)
  })

  it("an amount that is ALSO the order's total is ambiguous: neither is touched", async () => {
    audit.clear()
    traceLine("cs_1:line:1", 1000)
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_x", amount: 1000 }], 1000))
    expect(orderUpdates).toEqual([])
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(audit.has("unallocated-line-refunded:cs_1:line:1")).toBe(false)
  })

  it("a refund that names the order is still that order's, next to a manual refund of the lost line", async () => {
    await handleStripeChargeRefundedWithCommission(
      charge(
        [
          { id: "re_manual", amount: 2000 },
          { id: "re_A", amount: 300, orderId: "A" },
        ],
        2300
      )
    )
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A", amountCents: 300 })])
    expect(orderUpdates.find((u) => u.id === "A")?.data).toEqual({ paymentSettlementStatus: "PARTIALLY_REFUNDED" })
    expect(clawbackFull).not.toHaveBeenCalled()
  })

  it("a cart whose lines are ALL unallocated has no order: the manual refund still leaves its proof (the line can never become an order)", async () => {
    delete orders.A
    const res = await handleStripeChargeRefundedWithCommission(charge([{ id: "re_manual", amount: 2000 }], 2000))
    expect(res.processedOrderIds).toEqual([])
    expect(audit.get("unallocated-line-refunded:cs_1:line:1")).toBeDefined()
  })

  it("the closed skeleton order of a single-line checkout is not a sale: a manual refund of its line is recognised, not ambiguous", async () => {
    delete orders.A
    audit.clear()
    traceLine("cs_1:line:0", 4000)
    orders.skeleton = { ...row("skeleton", 4000), status: "CANCELLED", paymentSettlementStatus: "CANCELLED" }
    const res = await handleStripeChargeRefundedWithCommission(charge([{ id: "re_manual", amount: 4000 }], 4000, 4000))
    expect(res.processedOrderIds).toEqual([])
    expect(orderUpdates).toEqual([])
    expect(audit.get("unallocated-line-refunded:cs_1:line:0")).toBeDefined()
    expect(opsAlert.mock.calls.some((c) => String(c[0]).includes("NOT applied to any order"))).toBe(false)
  })

  it("a charge with no traced line is untouched by all this: the sole order refunded in full is full", async () => {
    audit.clear()
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 1000 }], 1000, 1000))
    expect(clawbackFull).toHaveBeenCalledTimes(1)
    expect(orderUpdates.find((u) => u.id === "A")?.data).toMatchObject({ status: "refunded" })
  })
})

describe("#1 — a bare (dashboard) refund of the REMAINING order on a charge that has a traced line is applied to that order, not dropped", () => {
  // order A 10 EUR; lost line C 5 EUR, ALREADY refunded (marker refund + proof row): what production always has
  const seed = (opts: { cRefunded: boolean }) => {
    audit.set("unallocated-line:cs_1:line:1", {
      id: "unallocated-line:cs_1:line:1",
      action: "payment.unallocated_line",
      entityId: "cs_1:line:1",
      payload: { paymentIntentId: "pi_1", refundableCents: 500 },
    })
    if (opts.cRefunded) {
      audit.set("unallocated-line-refunded:cs_1:line:1", {
        id: "unallocated-line-refunded:cs_1:line:1",
        action: "payment.unallocated_line.refunded",
        entityId: "cs_1:line:1",
        payload: { stripeRefundId: "re_C", amountCents: 500 },
      })
    }
  }

  beforeEach(() => {
    for (const k of Object.keys(orders)) delete orders[k]
    audit.clear()
    recordedRefunds.length = 0
    orderUpdates.length = 0
    reverse.mockClear()
    clawbackFull.mockClear()
    clawbackPartial.mockClear()
    notifyCancelled.mockClear()
    opsAlert.mockClear()
    orders.A = row("A", 1000)
  })

  it("S1: the lost line was refunded (marker refund), then support refunds the whole order from the dashboard: A is refunded, payouts clawed back", async () => {
    seed({ cRefunded: true })
    const res = await handleStripeChargeRefundedWithCommission(
      charge(
        [
          { id: "re_C", amount: 500, unallocated: true },
          { id: "re_A", amount: 1000 },
        ],
        1500,
        1500
      )
    )
    expect(res.processedOrderIds).toEqual(["A"])
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A", amountCents: 1000 })])
    expect(clawbackFull).toHaveBeenCalledTimes(1)
    expect(orderUpdates.find((u) => u.id === "A")?.data).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED" })
    expect(opsAlert.mock.calls.some((c) => String(c[0]).includes("NOT applied to any order"))).toBe(false)
  })

  it("S1b: the lost line was refunded BY HAND (proof recorded, bare refund), then a partial bare refund of the order: PARTIALLY_REFUNDED", async () => {
    seed({ cRefunded: true })
    audit.set("unallocated-line-refunded:cs_1:line:1", {
      id: "unallocated-line-refunded:cs_1:line:1",
      action: "payment.unallocated_line.refunded",
      entityId: "cs_1:line:1",
      payload: { stripeRefundId: "re_Cbare", amountCents: 500, source: "manual_dashboard" },
    })
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_Cbare", amount: 500 }, { id: "re_A", amount: 300 }], 800, 1500))
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A", amountCents: 300 })])
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(orderUpdates.find((u) => u.id === "A")?.data).toEqual({ paymentSettlementStatus: "PARTIALLY_REFUNDED" })
  })

  it("the line still owed + a bare refund of exactly the order's total: the order's (applied)", async () => {
    seed({ cRefunded: false })
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 1000 }], 1000, 1500))
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A" })])
    expect(clawbackFull).toHaveBeenCalledTimes(1)
  })

  it("S2: the line still owed + the dashboard's whole-charge default amount: ambiguous, applied to NOTHING, ops alerted (no clawback, order unchanged)", async () => {
    seed({ cRefunded: false })
    const res = await handleStripeChargeRefundedWithCommission(charge([{ id: "re_all", amount: 1500 }], 1500, 1500))
    expect(res.processedOrderIds).toEqual([])
    expect(recordedRefunds).toEqual([])
    expect(orderUpdates).toEqual([])
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(opsAlert.mock.calls.some((c) => String(c[0]).includes("NOT applied to any order"))).toBe(true)
  })

  it("the line still owed + a partial bare refund: still ambiguous (it could be the line's), never the sibling order's", async () => {
    seed({ cRefunded: false })
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_x", amount: 300 }], 300, 1500))
    expect(recordedRefunds).toEqual([])
    expect(orderUpdates).toEqual([])
    expect(clawbackPartial).not.toHaveBeenCalled()
  })

  it("a replay of the same event after the order refund changes nothing more (the refund is already recorded)", async () => {
    seed({ cRefunded: true })
    const ev = () => charge([{ id: "re_C", amount: 500, unallocated: true }, { id: "re_A", amount: 1000 }], 1500, 1500)
    await handleStripeChargeRefundedWithCommission(ev())
    const n = recordedRefunds.length
    await handleStripeChargeRefundedWithCommission(ev())
    expect(recordedRefunds).toHaveLength(n)
  })
})
