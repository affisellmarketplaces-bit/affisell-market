import {
  netPayoutCents,
  rateBps,
  sumPeriods,
  type PaidOrderFact,
  type PeriodFigures,
  type ProductAggregate,
} from "@/lib/intelligence/order-aggregates"
import {
  measurePriceChanges,
  simulatePrices,
  type ListingPriceChange,
  type PriceChangeImpact,
  type PriceSimulation,
} from "@/lib/intelligence/price-simulation"
import {
  attributeProfitChange,
  residualIsLarge,
  significantNegativeDrivers,
  type ProfitAttribution,
} from "@/lib/intelligence/profit-attribution"

/**
 * Per-reseller performance — pure (commercial intelligence A, "my products"). Answers, for ONE reseller and from that
 * reseller's own paid orders only (`Order.affiliateId` = the viewer; the loader never reads anyone else's):
 *
 *   1. what really earns me the most — net kept = what the orders transferred (commission + markup − Affisell's fee)
 *      minus the share refunds took back (pro rata, like the transfer reversal);
 *   2. what is becoming less profitable, and why — current 30 days vs the 30 before, the change split between volume,
 *      my selling price, the supplier price, the commission, the fees and the refunds (lib/intelligence/
 *      profit-attribution.ts, exact with a residual). A cause is named only when its share of the decline is
 *      significant; "my price cut" only when the listing-price history shows a cut — otherwise "lower price collected";
 *   3. what deserves my attention today — facts that call for an action;
 *   4. what my own price changes did (observed before / after) and what other prices would pay per sale (simulation).
 *
 * Nothing is predicted; a comparison is only made when the earlier period has enough orders to mean something.
 */
export const MIN_ORDERS_TO_COMPARE = 3
export const PRICE_CHANGE_RECENT_DAYS = 7

export type ResellerProductInfo = {
  productId: string
  name: string
  /** Listed in the viewer's store (AffiliateProduct.isListed). */
  listed: boolean
  /** Still buyable on the marketplace (active, not draft). */
  buyable: boolean
  stock: { units: number; meaningful: boolean } | null
  /** AffiliateProduct.marginReviewNeeded — set when the supplier price moved against the listing. */
  marginReviewNeeded: boolean
  currentBasePriceCents: number
  /** Supplier base price at the start of the current period (history), when known. */
  basePriceAtPeriodStartCents: number | null
  /** Last recorded base-price change, when known. */
  lastPriceChange: { at: Date; fromCents: number | null; toCents: number } | null
  /** The reseller's listing price today (HT) and the commission the supplier offers today (percent). */
  listingPriceCents?: number | null
  commissionPercent?: number
  /** AffiliateProduct id (link to the reseller's own price editor). */
  listingId?: string | null
}

export type ResellerSignals = {
  /** Orders of this reseller with a dispute still open in the ledger (`dispute_open`). */
  openDisputesByProduct: Map<string, number>
  /** Returns REQUESTED (awaiting the supplier) on this reseller's orders. */
  pendingReturnsByProduct: Map<string, number>
}

export type PeriodSummary = {
  orders: number
  units: number
  netCents: number
  netPerUnitCents: number | null
  refundShareBps: number
  refundedOrders: number
  disputedOrders: number
}

export type ProductPerformance = {
  productId: string
  name: string
  current: PeriodSummary
  previous: PeriodSummary
  comparable: boolean
}

export type DeclineReason =
  | "volume_down"
  | "your_price_down"
  | "collected_price_down"
  | "supplier_price_up"
  | "commission_down"
  | "fees_up"
  | "refunds_up"
  | "disputes_up"

export type DecliningProduct = ProductPerformance & {
  netChangeCents: number
  reasons: DeclineReason[]
  attribution: ProfitAttribution
  /** The residual is a large share of the change: part of it is not explained by the data. */
  partlyUnexplained: boolean
  /** Recorded cuts of the listing price in the comparison window (from → to, source). */
  priceCutEvidence: Array<{ fromCents: number; toCents: number; source: string; at: string }>
  /** Last recorded supplier price change in the comparison window, when the history has one. */
  supplierPriceChange: { fromCents: number; toCents: number; at: string } | null
  listingId: string | null
}

export type AttentionKind =
  | "open_dispute"
  | "no_longer_for_sale"
  | "sold_out"
  | "margin_review"
  | "supplier_price_changed"
  | "return_requested"

export type AttentionItem = {
  kind: AttentionKind
  productId: string
  name: string
  evidence: Record<string, number | string | null>
}

export type ResellerPerformance = {
  topEarners: ProductPerformance[]
  declining: DecliningProduct[]
  attention: AttentionItem[]
  priceChangeImpacts: Array<PriceChangeImpact & { name: string }>
  simulations: Array<PriceSimulation & { name: string; currentPriceCents: number; listingId: string | null }>
  totals: { current: PeriodSummary; previous: PeriodSummary }
}

function summarize(p: PeriodFigures): PeriodSummary {
  const net = netPayoutCents(p)
  return {
    orders: p.orders,
    units: p.units,
    netCents: net,
    netPerUnitCents: p.units > 0 ? Math.round(net / p.units) : null,
    refundShareBps: rateBps(p.refundedCents, p.chargedCents),
    refundedOrders: p.refundedOrders,
    disputedOrders: p.disputedOrders,
  }
}

const ATTENTION_ORDER: AttentionKind[] = [
  "open_dispute",
  "no_longer_for_sale",
  "sold_out",
  "margin_review",
  "supplier_price_changed",
  "return_requested",
]

const DRIVER_REASON = {
  volume: "volume_down",
  supplier_price: "supplier_price_up",
  commission: "commission_down",
  fees: "fees_up",
  refunds: "refunds_up",
} as const

export function buildResellerPerformance(input: {
  aggregates: Map<string, ProductAggregate>
  products: Map<string, ResellerProductInfo>
  signals: ResellerSignals
  now: Date
  limit?: number
  /** This reseller's listing-price history (any product) and orders, for the cut evidence and the before/after. */
  listingChanges?: ListingPriceChange[]
  factsByProduct?: Map<string, PaidOrderFact[]>
  /** Start of the previous period (the comparison window starts there). */
  comparisonStart?: Date
  /** Start of the current period. */
  periodStart?: Date
}): ResellerPerformance {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100))
  const changes = input.listingChanges ?? []
  const perf: ProductPerformance[] = []
  for (const agg of input.aggregates.values()) {
    const info = input.products.get(agg.productId)
    const current = summarize(agg.current)
    const previous = summarize(agg.previous)
    perf.push({
      productId: agg.productId,
      name: info?.name ?? agg.productId,
      current,
      previous,
      comparable: current.orders >= MIN_ORDERS_TO_COMPARE && previous.orders >= MIN_ORDERS_TO_COMPARE,
    })
  }

  const topEarners = perf
    .filter((p) => p.current.orders > 0)
    .sort((a, b) => b.current.netCents - a.current.netCents || a.productId.localeCompare(b.productId))
    .slice(0, limit)

  const windowStart = input.comparisonStart?.getTime() ?? -Infinity
  const declining: DecliningProduct[] = []
  for (const p of perf) {
    // Judged only on a product that was really selling before (enough earlier orders); the current period may be empty.
    if (p.previous.orders < MIN_ORDERS_TO_COMPARE) continue
    const netChange = p.current.netCents - p.previous.netCents
    if (netChange >= 0) continue
    const agg = input.aggregates.get(p.productId)!
    const attribution = attributeProfitChange(agg.previous, agg.current)
    const cuts = changes
      .filter(
        (c) =>
          c.productId === p.productId &&
          c.variantKey === null &&
          c.priceCents !== null &&
          c.previousCents !== null &&
          c.priceCents < c.previousCents &&
          c.effectiveAt.getTime() >= windowStart &&
          c.effectiveAt.getTime() <= input.now.getTime()
      )
      .map((c) => ({ fromCents: c.previousCents!, toCents: c.priceCents!, source: c.source, at: c.effectiveAt.toISOString() }))
    const reasons: DeclineReason[] = []
    for (const driver of significantNegativeDrivers(attribution)) {
      if (driver === "selling_price") reasons.push(cuts.length > 0 ? "your_price_down" : "collected_price_down")
      else reasons.push(DRIVER_REASON[driver])
    }
    if (p.current.disputedOrders > p.previous.disputedOrders) reasons.push("disputes_up")
    const info = input.products.get(p.productId)
    const sc = info?.lastPriceChange
    declining.push({
      ...p,
      netChangeCents: netChange,
      reasons,
      attribution,
      partlyUnexplained: residualIsLarge(attribution),
      priceCutEvidence: cuts,
      supplierPriceChange:
        sc && sc.fromCents != null && sc.at.getTime() >= windowStart && sc.at.getTime() <= input.now.getTime()
          ? { fromCents: sc.fromCents, toCents: sc.toCents, at: sc.at.toISOString() }
          : null,
      listingId: info?.listingId ?? null,
    })
  }
  declining.sort((a, b) => a.netChangeCents - b.netChangeCents || a.productId.localeCompare(b.productId))

  const attention: AttentionItem[] = []
  const recentMs = PRICE_CHANGE_RECENT_DAYS * 24 * 60 * 60 * 1000
  for (const info of input.products.values()) {
    const sold = input.aggregates.get(info.productId)
    const soldRecently = (sold?.current.orders ?? 0) + (sold?.previous.orders ?? 0) > 0
    const disputes = input.signals.openDisputesByProduct.get(info.productId) ?? 0
    if (disputes > 0) attention.push({ kind: "open_dispute", productId: info.productId, name: info.name, evidence: { orders: disputes } })
    if (info.listed && !info.buyable) {
      attention.push({ kind: "no_longer_for_sale", productId: info.productId, name: info.name, evidence: { soldRecently: soldRecently ? 1 : 0 } })
    } else if (info.listed && info.stock?.meaningful && info.stock.units <= 0) {
      attention.push({ kind: "sold_out", productId: info.productId, name: info.name, evidence: { stock: info.stock.units } })
    }
    if (info.listed && info.marginReviewNeeded) {
      attention.push({ kind: "margin_review", productId: info.productId, name: info.name, evidence: { priceCents: info.currentBasePriceCents } })
    }
    if (
      info.listed &&
      info.lastPriceChange &&
      input.now.getTime() - info.lastPriceChange.at.getTime() <= recentMs &&
      info.lastPriceChange.fromCents != null
    ) {
      attention.push({
        kind: "supplier_price_changed",
        productId: info.productId,
        name: info.name,
        evidence: {
          fromCents: info.lastPriceChange.fromCents,
          toCents: info.lastPriceChange.toCents,
          at: info.lastPriceChange.at.toISOString(),
        },
      })
    }
    const returns = input.signals.pendingReturnsByProduct.get(info.productId) ?? 0
    if (returns > 0) attention.push({ kind: "return_requested", productId: info.productId, name: info.name, evidence: { returns } })
  }
  attention.sort(
    (a, b) => ATTENTION_ORDER.indexOf(a.kind) - ATTENTION_ORDER.indexOf(b.kind) || a.productId.localeCompare(b.productId)
  )

  const nameOf = (id: string) => input.products.get(id)?.name ?? id
  const priceChangeImpacts = input.factsByProduct
    ? measurePriceChanges({ changes, factsByProduct: input.factsByProduct, now: input.now })
        .slice(0, limit)
        .map((i) => ({ ...i, name: nameOf(i.productId) }))
    : []

  const periodStart = input.periodStart?.getTime() ?? -Infinity
  const simulations: ResellerPerformance["simulations"] = []
  for (const info of input.products.values()) {
    const agg = input.aggregates.get(info.productId)
    if (!info.listed || !agg || info.listingPriceCents == null || info.listingPriceCents <= 0) continue
    const cur = agg.current
    const gross = cur.payoutCents + cur.feeCents
    const sim = simulatePrices({
      productId: info.productId,
      currentPriceCents: info.listingPriceCents,
      supplierPriceCents: info.currentBasePriceCents,
      commissionPercent: info.commissionPercent ?? 0,
      feeShareBps: gross > 0 && cur.feeCents > 0 ? rateBps(cur.feeCents, gross) : null,
      refundShareBps: rateBps(agg.quality.refundedCents, agg.quality.chargedCents),
      observedNet30Cents: netPayoutCents(cur),
      orders30: cur.orders,
      supplierPriceAtPeriodStartCents: info.basePriceAtPeriodStartCents,
      listingPriceChangedInPeriod: changes.some(
        (c) => c.productId === info.productId && c.variantKey === null && c.effectiveAt.getTime() >= periodStart
      ),
    })
    if (sim.status === "ok") simulations.push({ ...sim, name: info.name, currentPriceCents: info.listingPriceCents, listingId: info.listingId ?? null })
  }
  simulations.sort((a, b) => b.assumptions.observedNet30Cents - a.assumptions.observedNet30Cents || a.productId.localeCompare(b.productId))

  const all = [...input.aggregates.values()]
  return {
    topEarners,
    declining: declining.slice(0, limit),
    attention: attention.slice(0, limit * 2),
    priceChangeImpacts,
    simulations: simulations.slice(0, limit),
    totals: {
      current: summarize(sumPeriods(all.map((a) => a.current))),
      previous: summarize(sumPeriods(all.map((a) => a.previous))),
    },
  }
}
