import { describe, expect, it } from "vitest"

import { aggregatePaidOrders, DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import { buildResellerPerformance, type ResellerProductInfo } from "@/lib/intelligence/reseller-performance"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)
let seq = 0
function orders(productId: string, n: number, day: number, over: Partial<PaidOrderFact> = {}): PaidOrderFact[] {
  return Array.from({ length: n }, () => ({
    orderId: `o${++seq}`,
    productId,
    quantity: 1,
    chargedCents: 10_000,
    paidAt: daysAgo(day),
    affiliatePayoutCents: 1000,
    refundedCents: 0,
    disputed: false,
    ...over,
  }))
}

function info(productId: string, over: Partial<ResellerProductInfo> = {}): ResellerProductInfo {
  return {
    productId,
    name: productId.toUpperCase(),
    listed: true,
    buyable: true,
    stock: { units: 10, meaningful: true },
    marginReviewNeeded: false,
    currentBasePriceCents: 5000,
    basePriceAtPeriodStartCents: 5000,
    lastPriceChange: null,
    ...over,
  }
}

function build(facts: PaidOrderFact[], products: ResellerProductInfo[], signals?: Partial<{ disputes: Record<string, number>; returns: Record<string, number> }>) {
  return buildResellerPerformance({
    aggregates: aggregatePaidOrders(facts, { now, periodDays: 30, qualityDays: 60 }),
    products: new Map(products.map((p) => [p.productId, p])),
    signals: {
      openDisputesByProduct: new Map(Object.entries(signals?.disputes ?? {})),
      pendingReturnsByProduct: new Map(Object.entries(signals?.returns ?? {})),
    },
    now,
  })
}

describe("buildResellerPerformance — what earns me the most", () => {
  it("ranks by net KEPT (payouts − pro-rata refund reversal), not by gross payouts", () => {
    const r = build(
      [...orders("a", 5, 2, { refundedCents: 5000 }), ...orders("b", 4, 2)], // a: 5 × 1000 − 5 × 500 = 2500 ; b: 4000
      [info("a"), info("b")]
    )
    expect(r.topEarners.map((p) => [p.productId, p.current.netCents])).toEqual([
      ["b", 4000],
      ["a", 2500],
    ])
    expect(r.topEarners[1]!.current.refundShareBps).toBe(5000)
    expect(r.totals.current).toMatchObject({ orders: 9, netCents: 6500 })
  })
})

describe("buildResellerPerformance — what is becoming less profitable, and why", () => {
  it("names the causes the data shows: fewer units, refunds up, supplier price down", () => {
    const r = build(
      [...orders("a", 10, 40), ...orders("a", 4, 5, { refundedCents: 2000, affiliatePayoutCents: 900 })],
      [info("a", { currentBasePriceCents: 4500, basePriceAtPeriodStartCents: 5000 })]
    )
    const d = r.declining[0]!
    expect(d.productId).toBe("a")
    expect(d.netChangeCents).toBeLessThan(0)
    expect(d.reasons).toEqual(expect.arrayContaining(["fewer_units", "lower_net_per_unit", "refund_share_up", "supplier_price_down"]))
  })

  it("does not judge a product that barely sold before (fewer than 3 earlier orders)", () => {
    const r = build([...orders("a", 2, 40)], [info("a")])
    expect(r.declining).toEqual([])
  })

  it("a product that stopped selling entirely is declining with 'fewer units'", () => {
    const r = build([...orders("a", 5, 40)], [info("a")])
    expect(r.declining[0]).toMatchObject({ productId: "a", netChangeCents: -5000, reasons: ["fewer_units"] })
  })

  it("a growing product is not declining", () => {
    const r = build([...orders("a", 3, 40), ...orders("a", 6, 3)], [info("a")])
    expect(r.declining).toEqual([])
  })
})

describe("buildResellerPerformance — what deserves my attention today", () => {
  it("lists verifiable facts in a fixed order of urgency", () => {
    const r = build(
      [],
      [
        info("ret"),
        info("price", { lastPriceChange: { at: daysAgo(2), fromCents: 5000, toCents: 5600 } }),
        info("oldprice", { lastPriceChange: { at: daysAgo(20), fromCents: 5000, toCents: 5600 } }),
        info("margin", { marginReviewNeeded: true }),
        info("oos", { stock: { units: 0, meaningful: true } }),
        info("unknownstock", { stock: { units: 0, meaningful: false } }),
        info("gone", { buyable: false, stock: { units: 0, meaningful: true } }),
        info("notlisted", { listed: false, buyable: false, marginReviewNeeded: true }),
        info("disp"),
      ],
      { disputes: { disp: 2 }, returns: { ret: 1 } }
    )
    expect(r.attention.map((a) => [a.kind, a.productId])).toEqual([
      ["open_dispute", "disp"],
      ["no_longer_for_sale", "gone"], // and NOT also "sold_out"
      ["sold_out", "oos"],
      ["margin_review", "margin"],
      ["supplier_price_changed", "price"],
      ["return_requested", "ret"],
    ])
    expect(r.attention.find((a) => a.kind === "supplier_price_changed")!.evidence).toMatchObject({ fromCents: 5000, toCents: 5600 })
  })
})
