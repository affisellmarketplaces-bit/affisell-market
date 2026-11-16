import {
  netPayoutCents,
  rateBps,
  type PeriodFigures,
  type ProductAggregate,
} from "@/lib/intelligence/order-aggregates"

/**
 * Per-reseller performance — pure (commercial intelligence A, "my products"). Answers three questions for ONE reseller,
 * from that reseller's own paid orders only (`Order.affiliateId` = the viewer; the loader never reads anyone else's):
 *
 *   1. what really earns me the most — net kept = payouts recorded on my orders − the share refunds took back (pro rata);
 *   2. what is becoming less profitable, and why — current 30 days vs the 30 before, with the causes the data can show;
 *   3. what deserves my attention today — facts that call for an action (open dispute, product no longer for sale, sold
 *      out, margin to review, supplier price just changed, return requested).
 *
 * Nothing is predicted; a comparison is only made when both periods have enough orders to mean something.
 */
export const MIN_ORDERS_TO_COMPARE = 3
/** A refund share this much higher (in basis points of value) than in the previous period is named as a cause. */
export const REFUND_SHARE_UP_BPS = 500
export const UNITS_DOWN_BPS = 3000
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
}

export type ResellerSignals = {
  /** Orders of this reseller with a dispute still open in the ledger (`dispute_open`). */
  openDisputesByProduct: Map<string, number>
  /** Returns REQUESTED (awaiting the supplier) on this reseller's orders. */
  pendingReturnsByProduct: Map<string, number>
}

export type ProductPerformance = {
  productId: string
  name: string
  current: PeriodSummary
  previous: PeriodSummary
  comparable: boolean
}

export type PeriodSummary = {
  orders: number
  units: number
  netCents: number
  netPerUnitCents: number | null
  refundShareBps: number
  disputedOrders: number
}

export type DeclineReason =
  | "fewer_units"
  | "lower_net_per_unit"
  | "refund_share_up"
  | "supplier_price_down"
  | "disputes_up"

export type DecliningProduct = ProductPerformance & {
  netChangeCents: number
  reasons: DeclineReason[]
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
  /** What the item rests on, in numbers (count of orders, prices…). */
  evidence: Record<string, number | string | null>
}

export type ResellerPerformance = {
  topEarners: ProductPerformance[]
  declining: DecliningProduct[]
  attention: AttentionItem[]
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
    disputedOrders: p.disputedOrders,
  }
}

function sumPeriods(list: PeriodFigures[]): PeriodFigures {
  const out: PeriodFigures = { orders: 0, units: 0, chargedCents: 0, refundedCents: 0, disputedOrders: 0, payoutCents: 0, payoutReversedCents: 0 }
  for (const p of list) {
    out.orders += p.orders
    out.units += p.units
    out.chargedCents += p.chargedCents
    out.refundedCents += p.refundedCents
    out.disputedOrders += p.disputedOrders
    out.payoutCents += p.payoutCents
    out.payoutReversedCents += p.payoutReversedCents
  }
  return out
}

const ATTENTION_ORDER: AttentionKind[] = [
  "open_dispute",
  "no_longer_for_sale",
  "sold_out",
  "margin_review",
  "supplier_price_changed",
  "return_requested",
]

export function buildResellerPerformance(input: {
  aggregates: Map<string, ProductAggregate>
  products: Map<string, ResellerProductInfo>
  signals: ResellerSignals
  now: Date
  limit?: number
}): ResellerPerformance {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100))
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

  const declining: DecliningProduct[] = []
  for (const p of perf) {
    // Judged only on a product that was really selling before (enough earlier orders); the current period may be empty.
    if (p.previous.orders < MIN_ORDERS_TO_COMPARE) continue
    const netChange = p.current.netCents - p.previous.netCents
    if (netChange >= 0) continue
    const reasons: DeclineReason[] = []
    if (p.previous.units > 0 && ((p.previous.units - p.current.units) * 10_000) / p.previous.units >= UNITS_DOWN_BPS) {
      reasons.push("fewer_units")
    }
    if (
      p.current.orders >= MIN_ORDERS_TO_COMPARE &&
      p.current.netPerUnitCents !== null &&
      p.previous.netPerUnitCents !== null &&
      p.current.netPerUnitCents < p.previous.netPerUnitCents
    ) {
      reasons.push("lower_net_per_unit")
    }
    if (p.current.orders > 0 && p.current.refundShareBps - p.previous.refundShareBps >= REFUND_SHARE_UP_BPS) {
      reasons.push("refund_share_up")
    }
    const info = input.products.get(p.productId)
    if (
      info?.basePriceAtPeriodStartCents != null &&
      info.currentBasePriceCents < info.basePriceAtPeriodStartCents
    ) {
      // The reseller's commission is a percentage of the supplier price: a lower price lowers every payout.
      reasons.push("supplier_price_down")
    }
    if (p.current.disputedOrders > p.previous.disputedOrders) reasons.push("disputes_up")
    declining.push({ ...p, netChangeCents: netChange, reasons })
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

  const all = [...input.aggregates.values()]
  return {
    topEarners,
    declining: declining.slice(0, limit),
    attention: attention.slice(0, limit * 2),
    totals: {
      current: summarize(sumPeriods(all.map((a) => a.current))),
      previous: summarize(sumPeriods(all.map((a) => a.previous))),
    },
  }
}
