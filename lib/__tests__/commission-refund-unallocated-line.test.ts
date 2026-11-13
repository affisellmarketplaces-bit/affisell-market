/**
 * D6 follow-up: the automatic refund of an unallocated line (`lib/unallocated-line.server.ts`) lands on the SAME Stripe
 * charge as the orders of the other lines. The `charge.refunded` handler must not attribute it to one of them: a lone
 * remaining order would look "fully refunded" (payouts clawed back, buyer told his valid order was cancelled).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = {
  id: string
  totalCents: number
  subtotalCents: number
  sellingPriceCents: number
  taxCents: number
  platformCommissionCents: number
  paymentSettlementStatus: string
}
const { orders, recordedRefunds, orderUpdates, reverse, clawbackFull, clawbackPartial, notifyCancelled } = vi.hoisted(() => ({
  orders: {} as Record<string, Row>,
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
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({}) }))
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
