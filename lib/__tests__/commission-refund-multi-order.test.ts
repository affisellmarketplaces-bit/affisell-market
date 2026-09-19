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
const { orders, recordedRefunds, orderUpdates, reverse, clawbackFull, clawbackPartial } = vi.hoisted(() => ({
  orders: {} as Record<string, Row>,
  recordedRefunds: [] as Array<{ orderId: string; stripeRefundId: string; amountCents: number }>,
  orderUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  reverse: vi.fn(async () => ({})),
  clawbackFull: vi.fn(async () => ({ executed: true })),
  clawbackPartial: vi.fn(async () => ({})),
}))

vi.mock("@/lib/emails/notify-order-cancelled", () => ({ notifyOrderCancelled: vi.fn(async () => {}) }))
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

function charge(refunds: Array<{ id: string; amount: number; orderId?: string }>, refunded: number) {
  return {
    id: "ch_1",
    amount: 4000,
    amount_refunded: refunded,
    refunds: {
      data: refunds.map((r) => ({ id: r.id, amount: r.amount, reason: null, metadata: r.orderId ? { orderId: r.orderId } : {} })),
    },
  } as never
}

describe("refund of a multi-order charge (A 30 €, B 10 €)", () => {
  beforeEach(() => {
    for (const k of Object.keys(orders)) delete orders[k]
    orders.A = row("A", 3000)
    orders.B = row("B", 1000)
    recordedRefunds.length = 0
    orderUpdates.length = 0
    reverse.mockClear()
    clawbackFull.mockClear()
    clawbackPartial.mockClear()
  })

  it("applies a refund only to the order it names", async () => {
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 3000, orderId: "A" }], 3000))
    expect(recordedRefunds).toEqual([expect.objectContaining({ orderId: "A", stripeRefundId: "re_A" })])
    expect(reverse).toHaveBeenCalledTimes(1)
    // B keeps its money: not refunded, no clawback for it.
    expect(orderUpdates.some((u) => u.id === "B")).toBe(false)
    expect(clawbackFull).toHaveBeenCalledTimes(1)
  })

  it("never guesses when a multi-order refund names no order", async () => {
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_X", amount: 3000 }], 3000))
    expect(recordedRefunds).toEqual([])
    expect(reverse).not.toHaveBeenCalled()
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(orderUpdates).toEqual([])
  })

  it("refunds the VAT too: a full refund of a VAT order is recognised at the charged total", async () => {
    orders.A = { ...row("A", 3000), totalCents: 3000, subtotalCents: 3000, taxCents: 600 } // corrupted total: HT only
    delete orders.B
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 3600 }], 3600))
    expect(clawbackFull).toHaveBeenCalledTimes(1)
    expect(orderUpdates.find((u) => u.id === "A")?.data.status).toBe("refunded")
  })

  it("does not treat an HT-only refund as full when VAT was charged", async () => {
    orders.A = { ...row("A", 3000), totalCents: 3000, subtotalCents: 3000, taxCents: 600 }
    delete orders.B
    await handleStripeChargeRefundedWithCommission(charge([{ id: "re_A", amount: 3000 }], 3000))
    expect(clawbackFull).not.toHaveBeenCalled()
    expect(orderUpdates.find((u) => u.id === "A")?.data.paymentSettlementStatus).toBe("PARTIALLY_REFUNDED")
  })
})
