import { computeSaleSplit } from "@/lib/money/sale-split"

/**
 * Sales-based opportunity board for resellers — pure, explainable, nothing invented (commercial intelligence A).
 *
 * WHAT IT IS: a ranking of catalogue products by what the platform's REAL sales of the last 30 days would have earned a
 * reseller, net of Affisell's reseller fee and of the refunds/returns actually observed on that product. Every figure
 * carries its source, its window and its sample size; flags say what to check (refund rate, slow delivery, rising supplier
 * price). It replaces nothing: the older "creators watching" pulse stays as it is.
 *
 * WHAT IT IS NOT: a prediction. "Observed earnings" is a past quantity (units sold on Affisell × what one unit pays a
 * reseller), not a forecast of what the next reseller will sell. A product with no paid order in the window gets NO score
 * — it is listed apart as "no sales data", never ranked by a guess. There is no model, no weighting by hand, no "AI".
 */
export const OPPORTUNITY_WINDOW_DAYS = 30
export const QUALITY_WINDOW_DAYS = 90
/** Below this many paid orders in 90 days the product's own refund rate is too thin to apply on its own. */
export const MIN_ORDERS_FOR_OWN_RATE = 10
export const HIGH_REFUND_RATE_BPS = 1500 // 15 %
export const SLOW_DELIVERY_P90_DAYS = 12

export type OpportunityInputRow = {
  productId: string
  name: string
  imageUrl: string | null
  supplierLabel: string
  basePriceCents: number
  /** Product.commissionRate, in percent (as stored). */
  commissionPercent: number
  /** Paid units / orders in the opportunity window (all resellers, all channels of the marketplace). */
  units30: number
  orders30: number
  /** Paid orders in the quality window, and how many of them were refunded or returned / disputed. */
  orders90: number
  refundedOrReturned90: number
  disputed90: number
  delivery: { p90EndToEndDays: number | null; sampleSize: number } | null
  priceTrend: "insufficient_history" | "stable" | "rising" | "falling" | "volatile" | null
  alreadyListedByViewer: boolean
}

export type OpportunityFactor = {
  key: string
  /** Value as a number (cents, basis points, days, count) — the UI formats it. */
  value: number | null
  unit: "cents" | "bps" | "days" | "count"
  /** Where it comes from, in words a reseller can check. */
  source: string
  window: string
  sampleSize: number | null
  /** observed = counted from Affisell's own data; computed = the settlement formula applied to observed data. */
  kind: "observed" | "computed"
}

export type OpportunityFlag = "high_refund_rate" | "disputes_seen" | "slow_delivery" | "supplier_price_rising" | "thin_sample"

export type RankedOpportunity = {
  productId: string
  name: string
  imageUrl: string | null
  supplierLabel: string
  alreadyListedByViewer: boolean
  /** What one sale pays a reseller at the supplier's commission with no markup, after Affisell's reseller fee. */
  resellerPayoutPerUnitCents: number
  /** Refund/return rate applied (bps) and where it came from. */
  refundRateBps: number
  refundRateSource: "product" | "platform"
  /** Per-unit payout after the refund rate. */
  netPerUnitCents: number
  /** units30 × netPerUnit — the ranking key. A PAST quantity, not a forecast. */
  observedNetEarnings30Cents: number
  factors: OpportunityFactor[]
  flags: OpportunityFlag[]
}

export type OpportunityBoard = {
  ranked: RankedOpportunity[]
  /** Catalogue products with no paid order in the window: shown as "no sales data", never scored. */
  noSalesData: Array<{ productId: string; name: string; imageUrl: string | null; supplierLabel: string; resellerPayoutPerUnitCents: number }>
  platformRefundRateBps: number
  platformOrders90: number
}

function nonNegInt(n: unknown): number {
  const v = Math.round(Number(n))
  return Number.isFinite(v) && v > 0 ? v : 0
}

export function resellerPayoutPerUnitCents(basePriceCents: number, commissionPercent: number): number {
  return computeSaleSplit({
    wholesaleCents: nonNegInt(basePriceCents),
    commissionBps: Math.round(Math.max(0, Number(commissionPercent) || 0) * 100),
    markupCents: 0,
    // The supplier-side fee does not change the reseller's share.
    supplierFeeBps: 0,
  }).resellerPayoutCents
}

function rateBps(part: number, total: number): number {
  return total > 0 ? Math.round((Math.min(part, total) / total) * 10_000) : 0
}

export function buildOpportunityBoard(rows: OpportunityInputRow[], opts: { limit?: number } = {}): OpportunityBoard {
  const platformOrders90 = rows.reduce((s, r) => s + nonNegInt(r.orders90), 0)
  const platformRefunds90 = rows.reduce((s, r) => s + nonNegInt(r.refundedOrReturned90), 0)
  const platformRefundRateBps = rateBps(platformRefunds90, platformOrders90)

  const ranked: RankedOpportunity[] = []
  const noSalesData: OpportunityBoard["noSalesData"] = []

  for (const row of rows) {
    const perUnit = resellerPayoutPerUnitCents(row.basePriceCents, row.commissionPercent)
    const units30 = nonNegInt(row.units30)
    if (units30 === 0) {
      noSalesData.push({
        productId: row.productId,
        name: row.name,
        imageUrl: row.imageUrl,
        supplierLabel: row.supplierLabel,
        resellerPayoutPerUnitCents: perUnit,
      })
      continue
    }

    const orders90 = nonNegInt(row.orders90)
    const ownRate = rateBps(nonNegInt(row.refundedOrReturned90), orders90)
    const useOwn = orders90 >= MIN_ORDERS_FOR_OWN_RATE
    const refundRateBps = useOwn ? ownRate : Math.max(ownRate, platformRefundRateBps)
    const netPerUnit = Math.round((perUnit * (10_000 - refundRateBps)) / 10_000)

    const flags: OpportunityFlag[] = []
    if (refundRateBps >= HIGH_REFUND_RATE_BPS) flags.push("high_refund_rate")
    if (nonNegInt(row.disputed90) > 0) flags.push("disputes_seen")
    if (row.delivery && row.delivery.sampleSize > 0 && (row.delivery.p90EndToEndDays ?? 0) > SLOW_DELIVERY_P90_DAYS) {
      flags.push("slow_delivery")
    }
    if (row.priceTrend === "rising" || row.priceTrend === "volatile") flags.push("supplier_price_rising")
    if (!useOwn) flags.push("thin_sample")

    ranked.push({
      productId: row.productId,
      name: row.name,
      imageUrl: row.imageUrl,
      supplierLabel: row.supplierLabel,
      alreadyListedByViewer: row.alreadyListedByViewer,
      resellerPayoutPerUnitCents: perUnit,
      refundRateBps,
      refundRateSource: useOwn ? "product" : "platform",
      netPerUnitCents: netPerUnit,
      observedNetEarnings30Cents: units30 * netPerUnit,
      factors: [
        {
          key: "units_sold",
          value: units30,
          unit: "count",
          source: "Commandes payées sur Affisell, tous revendeurs",
          window: `${OPPORTUNITY_WINDOW_DAYS} jours`,
          sampleSize: nonNegInt(row.orders30),
          kind: "observed",
        },
        {
          key: "payout_per_unit",
          value: perUnit,
          unit: "cents",
          source: "Formule de répartition Affisell (commission fournisseur, frais revendeur), sans marge ajoutée",
          window: "prix actuel",
          sampleSize: null,
          kind: "computed",
        },
        {
          key: "refund_rate",
          value: refundRateBps,
          unit: "bps",
          source: useOwn
            ? "Commandes de ce produit remboursées ou retournées"
            : "Trop peu de commandes pour ce produit : taux de la plateforme (le plus élevé des deux)",
          window: `${QUALITY_WINDOW_DAYS} jours`,
          sampleSize: useOwn ? orders90 : platformOrders90,
          kind: "observed",
        },
        {
          key: "delivery_p90",
          value: row.delivery?.p90EndToEndDays ?? null,
          unit: "days",
          source: "Livraisons attestées par le transporteur (fournisseur)",
          window: "180 jours",
          sampleSize: row.delivery?.sampleSize ?? 0,
          kind: "observed",
        },
      ],
      flags,
    })
  }

  ranked.sort(
    (a, b) =>
      b.observedNetEarnings30Cents - a.observedNetEarnings30Cents ||
      a.refundRateBps - b.refundRateBps ||
      a.productId.localeCompare(b.productId)
  )
  noSalesData.sort((a, b) => b.resellerPayoutPerUnitCents - a.resellerPayoutPerUnitCents || a.productId.localeCompare(b.productId))

  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200))
  return {
    ranked: ranked.slice(0, limit),
    noSalesData: noSalesData.slice(0, limit),
    platformRefundRateBps,
    platformOrders90,
  }
}
