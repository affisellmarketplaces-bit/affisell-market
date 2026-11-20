import { describe, expect, it } from "vitest"

import {
  aggregatePaidOrders,
  DAY_MS,
  netPayoutCents,
  reversedPayoutCents,
  type PaidOrderFact,
} from "@/lib/intelligence/order-aggregates"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)

function fact(over: Partial<PaidOrderFact> & { orderId: string }): PaidOrderFact {
  return {
    productId: "p",
    quantity: 1,
    chargedCents: 10_000,
    paidAt: daysAgo(1),
    affiliatePayoutCents: 1_600,
    refundedCents: 0,
    disputed: false,
    ...over,
  }
}

const opts = { now, periodDays: 30, qualityDays: 90 }

describe("reversedPayoutCents", () => {
  it("reverses the payout pro rata of the refund, capped at the charge", () => {
    expect(reversedPayoutCents(1600, 3000, 10_000)).toBe(480) // 30 % refund → 30 % of the payout
    expect(reversedPayoutCents(1600, 10_000, 10_000)).toBe(1600)
    expect(reversedPayoutCents(1600, 50_000, 10_000)).toBe(1600) // never more than the payout
    expect(reversedPayoutCents(1600, 0, 10_000)).toBe(0) // a rejected return = no refund row = nothing reversed
    expect(reversedPayoutCents(1600, 100, 0)).toBe(0)
  })
})

describe("aggregatePaidOrders", () => {
  it("splits periods on half-open boundaries (an order is never in two periods)", () => {
    const m = aggregatePaidOrders(
      [
        fact({ orderId: "a", paidAt: daysAgo(29.99) }),
        fact({ orderId: "b", paidAt: daysAgo(30) }), // exactly 30 days → previous period
        fact({ orderId: "c", paidAt: daysAgo(59.99) }),
        fact({ orderId: "d", paidAt: daysAgo(60) }), // out of both periods, still in the 90-day quality window
        fact({ orderId: "e", paidAt: daysAgo(91) }), // out of everything
      ],
      opts
    )
    const p = m.get("p")!
    expect(p.current.orders).toBe(1)
    expect(p.previous.orders).toBe(2)
    expect(p.quality.orders).toBe(4)
  })

  it("nets partial refunds pro rata and never double-counts an order", () => {
    const m = aggregatePaidOrders(
      [
        fact({ orderId: "a", refundedCents: 2500 }), // 25 % refund
        fact({ orderId: "a", refundedCents: 2500 }), // duplicate fact
        fact({ orderId: "b", quantity: 3 }),
        fact({ orderId: "c", disputed: true }), // won dispute: signal, no cost
      ],
      opts
    )
    const cur = m.get("p")!.current
    expect(cur).toMatchObject({ orders: 3, units: 5, chargedCents: 30_000, refundedCents: 2_500, disputedOrders: 1 })
    expect(cur.payoutReversedCents).toBe(400)
    expect(netPayoutCents(cur)).toBe(3 * 1600 - 400)
  })

  it("ignores an order dated in the future and caps a refund at the charge", () => {
    const m = aggregatePaidOrders(
      [fact({ orderId: "future", paidAt: new Date(now.getTime() + DAY_MS) }), fact({ orderId: "x", refundedCents: 99_999 })],
      opts
    )
    const cur = m.get("p")!.current
    expect(cur.orders).toBe(1)
    expect(cur.refundedCents).toBe(10_000)
    expect(netPayoutCents(cur)).toBe(0)
  })
})
