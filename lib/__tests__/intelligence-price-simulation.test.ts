import { describe, expect, it } from "vitest"

import { DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import {
  measurePriceChanges,
  netPerSaleCents,
  simulatePrices,
  type ListingPriceChange,
} from "@/lib/intelligence/price-simulation"
import { computeSaleSplit } from "@/lib/money/sale-split"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)
let seq = 0
function order(productId: string, day: number, net: number): PaidOrderFact {
  return { orderId: `o${++seq}`, productId, quantity: 1, chargedCents: 3000, paidAt: daysAgo(day), affiliatePayoutCents: net, refundedCents: 0, disputed: false }
}
function change(over: Partial<ListingPriceChange>): ListingPriceChange {
  return { affiliateProductId: "l1", productId: "p1", variantKey: null, priceCents: 2700, previousCents: 3000, source: "reseller_ui", effectiveAt: daysAgo(20), ...over }
}

describe("netPerSaleCents", () => {
  it("is the settlement formula's reseller payout, then the refund share", () => {
    const split = computeSaleSplit({ wholesaleCents: 2000, commissionBps: 1000, markupCents: 1000, supplierFeeBps: 0 })
    expect(netPerSaleCents({ priceCents: 3000, supplierPriceCents: 2000, commissionBps: 1000, feeShareBps: 2000, refundShareBps: 0 })).toBe(
      split.resellerPayoutCents
    )
    expect(netPerSaleCents({ priceCents: 3000, supplierPriceCents: 2000, commissionBps: 1000, feeShareBps: 2000, refundShareBps: 1000 })).toBe(864)
    // below the supplier price there is no markup: only the commission is left
    expect(netPerSaleCents({ priceCents: 1500, supplierPriceCents: 2000, commissionBps: 1000, feeShareBps: 2000, refundShareBps: 0 })).toBe(160)
  })
})

describe("simulatePrices", () => {
  const input = {
    productId: "p1",
    currentPriceCents: 3000,
    supplierPriceCents: 2000,
    commissionPercent: 10,
    feeShareBps: 2000,
    refundShareBps: 0,
    observedNet30Cents: 9600,
    orders30: 10,
    supplierPriceAtPeriodStartCents: 2000,
  }

  it("gives net per sale and sales needed to match the last 30 days for −10 % … +10 %", () => {
    const sim = simulatePrices(input)
    expect(sim.status).toBe("ok")
    expect(sim.grid.map((p) => [p.priceCents, p.netPerSaleCents, p.salesToMatchCents30])).toEqual([
      [2700, 720, 14],
      [2850, 840, 12],
      [3000, 960, 10],
      [3150, 1080, 9],
      [3300, 1200, 8],
    ])
    expect(sim.restoreMarkup).toBeNull()
  })

  it("never simulates on fewer than 5 orders", () => {
    expect(simulatePrices({ ...input, orders30: 4 })).toMatchObject({ status: "insufficient_orders", grid: [] })
  })

  it("offers the price that restores the markup when the supplier price rose and the reseller has not repriced", () => {
    const sim = simulatePrices({ ...input, supplierPriceCents: 2200, supplierPriceAtPeriodStartCents: 2000 })
    expect(sim.restoreMarkup).toMatchObject({ priceCents: 3200 })
    expect(simulatePrices({ ...input, supplierPriceCents: 2200, listingPriceChangedInPeriod: true }).restoreMarkup).toBeNull()
  })

  it("uses the standard fee when no fee was observed, and says so", () => {
    expect(simulatePrices({ ...input, feeShareBps: null }).assumptions).toMatchObject({ feeShareBps: 2000, feeShareSource: "standard" })
  })
})

describe("measurePriceChanges", () => {
  it("compares the 30 days before a change with the days after, per day and per sale", () => {
    const facts = [
      ...[45, 40, 35, 30, 25].map((d) => order("p1", d, 1000)), // before the change (20 days ago)
      ...[15, 10, 5].map((d) => order("p1", d, 700)),
    ]
    const [impact] = measurePriceChanges({ changes: [change({})], factsByProduct: new Map([["p1", facts]]), now })
    expect(impact).toMatchObject({ status: "measured", fromCents: 3000, toCents: 2700 })
    expect(impact!.before).toMatchObject({ orders: 5, netCents: 5000, netPerUnitCents: 1000, days: 30 })
    expect(impact!.after).toMatchObject({ orders: 3, netCents: 2100, netPerUnitCents: 700, days: 20 })
    expect(impact!.after.netPerDayCents).toBe(105)
  })

  it("cuts the windows at the neighbouring changes and says when it is too early or too thin", () => {
    const facts = [40, 35, 30].map((d) => order("p1", d, 1000))
    const out = measurePriceChanges({
      changes: [change({ effectiveAt: daysAgo(25) }), change({ effectiveAt: daysAgo(3), previousCents: 2700, priceCents: 2900 })],
      factsByProduct: new Map([["p1", facts]]),
      now,
    })
    expect(out.map((o) => o.status)).toEqual(["too_recent", "insufficient_orders"])
    expect(out[1]!.after.days).toBe(22) // ends at the next change
  })

  it("ignores variant prices and the first price of a listing (no 'from')", () => {
    const out = measurePriceChanges({
      changes: [change({ variantKey: "opt:red" }), change({ previousCents: null })],
      factsByProduct: new Map(),
      now,
    })
    expect(out).toEqual([])
  })
})
