import { describe, expect, it } from "vitest"

import { aggregatePaidOrders, DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import type { ListingPriceChange } from "@/lib/intelligence/price-simulation"
import { buildResellerPerformance, type ResellerProductInfo } from "@/lib/intelligence/reseller-performance"
import { computeSaleSplit } from "@/lib/money/sale-split"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)
let seq = 0

/** n one-unit orders settled with the canonical split. */
function orders(
  productId: string,
  n: number,
  day: number,
  o: { S?: number; W?: number; cBps?: number; refundBps?: number; disputed?: boolean } = {}
): PaidOrderFact[] {
  const S = o.S ?? 3000
  const W = o.W ?? 2000
  const split = computeSaleSplit({ wholesaleCents: W, commissionBps: o.cBps ?? 1000, markupCents: Math.max(0, S - W), supplierFeeBps: 0 })
  return Array.from({ length: n }, () => ({
    orderId: `o${++seq}`,
    productId,
    quantity: 1,
    chargedCents: S,
    paidAt: daysAgo(day),
    affiliatePayoutCents: split.resellerPayoutCents,
    refundedCents: Math.round((S * (o.refundBps ?? 0)) / 10_000),
    disputed: o.disputed ?? false,
    sellingCents: S,
    supplierCents: W,
    commissionCents: split.commissionCents,
    feeCents: split.resellerFeeCents,
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
    currentBasePriceCents: 2000,
    basePriceAtPeriodStartCents: 2000,
    lastPriceChange: null,
    listingPriceCents: 3000,
    commissionPercent: 10,
    listingId: `l-${productId}`,
    ...over,
  }
}

function build(
  facts: PaidOrderFact[],
  products: ResellerProductInfo[],
  extra: { disputes?: Record<string, number>; returns?: Record<string, number>; changes?: ListingPriceChange[] } = {}
) {
  const factsByProduct = new Map<string, PaidOrderFact[]>()
  for (const f of facts) factsByProduct.set(f.productId, [...(factsByProduct.get(f.productId) ?? []), f])
  return buildResellerPerformance({
    aggregates: aggregatePaidOrders(facts, { now, periodDays: 30, qualityDays: 60 }),
    products: new Map(products.map((p) => [p.productId, p])),
    signals: {
      openDisputesByProduct: new Map(Object.entries(extra.disputes ?? {})),
      pendingReturnsByProduct: new Map(Object.entries(extra.returns ?? {})),
    },
    now,
    listingChanges: extra.changes ?? [],
    factsByProduct,
    comparisonStart: daysAgo(60),
    periodStart: daysAgo(30),
  })
}

const cut = (productId: string, day: number, from: number, to: number, source = "reseller_ui"): ListingPriceChange => ({
  affiliateProductId: `l-${productId}`,
  productId,
  variantKey: null,
  priceCents: to,
  previousCents: from,
  source,
  effectiveAt: daysAgo(day),
})

describe("what earns me the most", () => {
  it("ranks by net KEPT (transfer − pro-rata refund reversal)", () => {
    const r = build([...orders("a", 5, 2, { refundBps: 5000 }), ...orders("b", 4, 2)], [info("a"), info("b")])
    expect(r.topEarners.map((p) => [p.productId, p.current.netCents])).toEqual([
      ["b", 3840],
      ["a", 2400],
    ])
    expect(r.totals.current).toMatchObject({ orders: 9, netCents: 6240 })
  })
})

describe("what is becoming less profitable, and why", () => {
  it("MY price cut — only when the listing-price history shows it", () => {
    const facts = [...orders("a", 10, 40), ...orders("a", 10, 5, { S: 2700 })]
    const withCut = build(facts, [info("a")], { changes: [cut("a", 25, 3000, 2700)] }).declining[0]!
    expect(withCut.reasons).toEqual(["your_price_down"])
    expect(withCut.priceCutEvidence).toEqual([expect.objectContaining({ fromCents: 3000, toCents: 2700, source: "reseller_ui" })])
    expect(withCut.attribution.effects.selling_price).toBe(-2400)

    // same orders, no recorded cut: the price COLLECTED was lower (discounts, variants…), not "you lowered your price"
    expect(build(facts, [info("a")]).declining[0]!.reasons).toEqual(["collected_price_down"])
  })

  it("a supplier price rise, a commission cut, more refunds, fewer sales, more disputes", () => {
    expect(build([...orders("a", 10, 40), ...orders("a", 10, 5, { W: 2200 })], [info("a")]).declining[0]!.reasons).toEqual([
      "supplier_price_up",
    ])
    expect(build([...orders("a", 10, 40), ...orders("a", 10, 5, { cBps: 500 })], [info("a")]).declining[0]!.reasons).toEqual([
      "commission_down",
    ])
    expect(build([...orders("a", 10, 40), ...orders("a", 10, 5, { refundBps: 3000 })], [info("a")]).declining[0]!.reasons).toEqual([
      "refunds_up",
    ])
    expect(build([...orders("a", 10, 40), ...orders("a", 4, 5)], [info("a")]).declining[0]!.reasons).toEqual(["volume_down"])
    expect(
      build([...orders("a", 10, 40), ...orders("a", 6, 5), ...orders("a", 2, 5, { disputed: true })], [info("a")]).declining[0]!.reasons
    ).toEqual(["volume_down", "disputes_up"])
  })

  it("names no cause the data cannot establish", () => {
    const facts = [...orders("a", 10, 40), ...orders("a", 10, 5)]
    // 3 000 less transferred (fee in proportion, so the fee share is unchanged), nothing else moved: unexplained money
    for (const f of facts.slice(10)) {
      f.affiliatePayoutCents -= 300
      f.feeCents = (f.feeCents ?? 0) - 75
    }
    const d = build(facts, [info("a")]).declining[0]!
    expect(d.reasons).toEqual([])
    expect(d.partlyUnexplained).toBe(true)
  })

  it("does not judge a product that barely sold before, nor a growing one", () => {
    expect(build(orders("a", 2, 40), [info("a")]).declining).toEqual([])
    expect(build([...orders("a", 3, 40), ...orders("a", 6, 3)], [info("a")]).declining).toEqual([])
  })
})

describe("what my price changes did, and simulations", () => {
  it("measures a recorded change and simulates prices on enough sales", () => {
    const facts = [...orders("a", 6, 45), ...orders("a", 6, 10, { S: 2700 })]
    const r = build(facts, [info("a", { listingPriceCents: 2700 })], { changes: [cut("a", 20, 3000, 2700)] })
    expect(r.priceChangeImpacts[0]).toMatchObject({ productId: "a", status: "measured", name: "A" })
    expect(r.simulations[0]).toMatchObject({ productId: "a", status: "ok", currentPriceCents: 2700, listingId: "l-a" })
  })

  it("no simulation for a product with fewer than 5 recent orders or not listed", () => {
    const r = build([...orders("a", 4, 5), ...orders("b", 8, 5)], [info("a"), info("b", { listed: false })])
    expect(r.simulations).toEqual([])
  })
})

describe("what deserves my attention today", () => {
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
      ["no_longer_for_sale", "gone"],
      ["sold_out", "oos"],
      ["margin_review", "margin"],
      ["supplier_price_changed", "price"],
      ["return_requested", "ret"],
    ])
  })
})
