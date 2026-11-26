import { computeSaleSplit } from "@/lib/money/sale-split"

/**
 * Sales-based opportunity board for resellers — pure, explainable, nothing invented (commercial intelligence A).
 *
 * WHAT IT IS: catalogue products ranked by what the platform's REAL paid orders of the last 30 days would have earned a
 * reseller, net of Affisell's reseller fee and of the money actually refunded on that product. Every figure carries its
 * source, window and sample size; flags say what to check. Products are split by how well they are documented:
 *   - "documented": at least MIN_ORDERS_DOCUMENTED paid orders in 90 days — the product's own rates are used;
 *   - "limited": some sales, too few to judge — the platform's rates are applied (the higher of the two) and it says so;
 *   - no sale in 30 days: NOT scored at all ("no sales data").
 *
 * WHAT IT IS NOT: a prediction. "Observed net earnings" is a past quantity (units sold × what one unit pays a reseller),
 * not what the next reseller will sell. No model, no hand-tuned weights, no "AI".
 *
 * Refunds are measured by VALUE (refunded cents / charged cents), so a partial refund weighs what it cost — not a whole
 * order — and a rejected return costs nothing. Returns that were refunded and lost disputes are refunds, so they are in
 * it. Disputes are counted separately (any dispute opened, won or lost, is a signal).
 */
export const OPPORTUNITY_WINDOW_DAYS = 30
export const QUALITY_WINDOW_DAYS = 90
/** From this many paid orders in 90 days the product's own refund rate is used on its own. */
export const MIN_ORDERS_DOCUMENTED = 10
export const HIGH_REFUND_RATE_BPS = 1500 // 15 % of the value charged
export const SLOW_DELIVERY_P90_DAYS = 12
/** Values that importers write by default instead of a maintained inventory (see AGENTS.md, stock). */
const NOMINAL_STOCK_VALUES = new Set([99, 999, 9999])

/**
 * Whether `Product.stock` says something about availability: physical listing, and either no variants or advanced SKU
 * rows (then `Product.stock` is their sum, 0 = every row sold out). Variants kept only in the ProductVariant table are
 * not tracked by checkout (AGENTS.md, stock): unknown.
 */
export function isProductStockMeaningful(p: { listingKind: string | null; hasVariants: boolean; variants: unknown }): boolean {
  if (String(p.listingKind ?? "PHYSICAL").toUpperCase() !== "PHYSICAL") return false
  const rows = (p.variants as { variantRows?: unknown } | null)?.variantRows
  if (Array.isArray(rows) && rows.length > 0) return true
  return !p.hasVariants
}

export type OpportunityInputRow = {
  productId: string
  name: string
  imageUrl: string | null
  supplierLabel: string
  basePriceCents: number
  /** Product.commissionRate, in percent (as stored). */
  commissionPercent: number
  /** Supplier base price 30 days ago (price history), when known. */
  basePrice30dAgoCents?: number | null
  /** Paid units / orders, last 30 days and the 30 days before (all resellers of the marketplace). */
  units30: number
  orders30: number
  unitsPrev30?: number
  ordersPrev30?: number
  /** Quality window: paid orders, what they charged and what was refunded on them (cents). */
  orders90: number
  chargedCents90?: number
  refundedCents90?: number
  /** Distinct orders with a dispute (open, won or lost) among the quality window's orders. */
  disputedOrders90: number
  delivery: { p90EndToEndDays: number | null; sampleSize: number } | null
  priceTrend: "insufficient_history" | "stable" | "rising" | "falling" | "volatile" | null
  /** Product.stock and whether checkout manages it for this product (physical, no table-only variants). */
  stock?: { units: number; managed: boolean } | null
  alreadyListedByViewer: boolean
}

export type OpportunityFactor = {
  key: string
  value: number | null
  unit: "cents" | "bps" | "days" | "count"
  source: string
  window: string
  sampleSize: number | null
  kind: "observed" | "computed"
}

export type OpportunityFlag =
  | "high_refund_rate"
  | "disputes_seen"
  | "slow_delivery"
  | "supplier_price_rising"
  | "thin_sample"
  | "sales_falling"
  | "payout_per_unit_down"
  | "out_of_stock"
  | "stock_not_maintained"

export type DataQuality = "documented" | "limited"

export type RankedOpportunity = {
  productId: string
  name: string
  imageUrl: string | null
  supplierLabel: string
  alreadyListedByViewer: boolean
  dataQuality: DataQuality
  resellerPayoutPerUnitCents: number
  /** Same formula at the supplier price of 30 days ago (null without price history). */
  resellerPayoutPerUnit30dAgoCents: number | null
  refundRateBps: number
  refundRateSource: "product" | "platform"
  disputeRateBps: number
  netPerUnitCents: number
  /** units30 × netPerUnit — the ranking key. A PAST quantity, not a forecast. */
  observedNetEarnings30Cents: number
  /** Units: last 30 days vs the 30 days before (both observed). */
  unitsChange: { current: number; previous: number; changeBps: number | null }
  factors: OpportunityFactor[]
  flags: OpportunityFlag[]
}

export type OpportunityBoard = {
  documented: RankedOpportunity[]
  limited: RankedOpportunity[]
  /** @deprecated kept for API callers of the first version: documented then limited. */
  ranked: RankedOpportunity[]
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

function changeBps(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 10_000) : null
}

export function buildOpportunityBoard(rows: OpportunityInputRow[], opts: { limit?: number } = {}): OpportunityBoard {
  const platformOrders90 = rows.reduce((s, r) => s + nonNegInt(r.orders90), 0)
  const platformCharged = rows.reduce((s, r) => s + nonNegInt(r.chargedCents90), 0)
  const platformRefunded = rows.reduce((s, r) => s + nonNegInt(r.refundedCents90), 0)
  const platformRefundRateBps = rateBps(platformRefunded, platformCharged)
  const platformDisputeRateBps = rateBps(
    rows.reduce((s, r) => s + nonNegInt(r.disputedOrders90), 0),
    platformOrders90
  )

  const scored: RankedOpportunity[] = []
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
    const documented = orders90 >= MIN_ORDERS_DOCUMENTED
    const ownRefund = rateBps(nonNegInt(row.refundedCents90), nonNegInt(row.chargedCents90))
    const ownDispute = rateBps(nonNegInt(row.disputedOrders90), orders90)
    const refundRateBps = documented ? ownRefund : Math.max(ownRefund, platformRefundRateBps)
    const disputeRateBps = documented ? ownDispute : Math.max(ownDispute, platformDisputeRateBps)
    const netPerUnit = Math.round((perUnit * (10_000 - refundRateBps)) / 10_000)

    const unitsPrev = nonNegInt(row.unitsPrev30)
    const unitsChange = { current: units30, previous: unitsPrev, changeBps: changeBps(units30, unitsPrev) }
    const perUnit30dAgo =
      row.basePrice30dAgoCents != null && row.basePrice30dAgoCents > 0
        ? resellerPayoutPerUnitCents(row.basePrice30dAgoCents, row.commissionPercent)
        : null

    const flags: OpportunityFlag[] = []
    if (refundRateBps >= HIGH_REFUND_RATE_BPS) flags.push("high_refund_rate")
    if (nonNegInt(row.disputedOrders90) > 0) flags.push("disputes_seen")
    if (row.delivery && row.delivery.sampleSize > 0 && (row.delivery.p90EndToEndDays ?? 0) > SLOW_DELIVERY_P90_DAYS) {
      flags.push("slow_delivery")
    }
    if (row.priceTrend === "rising" || row.priceTrend === "volatile") flags.push("supplier_price_rising")
    if (!documented) flags.push("thin_sample")
    // Falling sales only when the comparison rests on something (at least 3 units in the earlier period).
    if (unitsPrev >= 3 && unitsChange.changeBps !== null && unitsChange.changeBps <= -3000) flags.push("sales_falling")
    if (perUnit30dAgo !== null && perUnit < perUnit30dAgo) flags.push("payout_per_unit_down")
    if (row.stock?.managed && row.stock.units <= 0) flags.push("out_of_stock")
    if (row.stock?.managed && NOMINAL_STOCK_VALUES.has(row.stock.units)) flags.push("stock_not_maintained")

    scored.push({
      productId: row.productId,
      name: row.name,
      imageUrl: row.imageUrl,
      supplierLabel: row.supplierLabel,
      alreadyListedByViewer: row.alreadyListedByViewer,
      dataQuality: documented ? "documented" : "limited",
      resellerPayoutPerUnitCents: perUnit,
      resellerPayoutPerUnit30dAgoCents: perUnit30dAgo,
      refundRateBps,
      refundRateSource: documented ? "product" : "platform",
      disputeRateBps,
      netPerUnitCents: netPerUnit,
      observedNetEarnings30Cents: units30 * netPerUnit,
      unitsChange,
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
          key: "units_sold_previous",
          value: unitsPrev,
          unit: "count",
          source: "Commandes payées sur Affisell, tous revendeurs",
          window: `${OPPORTUNITY_WINDOW_DAYS} jours précédents`,
          sampleSize: nonNegInt(row.ordersPrev30),
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
          key: "payout_per_unit_30d_ago",
          value: perUnit30dAgo,
          unit: "cents",
          source: "Même formule, prix fournisseur relevé il y a 30 jours (historique des prix)",
          window: "il y a 30 jours",
          sampleSize: null,
          kind: "computed",
        },
        {
          key: "refund_rate",
          value: refundRateBps,
          unit: "bps",
          source: documented
            ? "Montants remboursés sur ce produit / montants encaissés (remboursements partiels au prorata)"
            : "Trop peu de commandes pour ce produit : taux de la plateforme (le plus élevé des deux)",
          window: `${QUALITY_WINDOW_DAYS} jours`,
          sampleSize: documented ? orders90 : platformOrders90,
          kind: "observed",
        },
        {
          key: "dispute_rate",
          value: disputeRateBps,
          unit: "bps",
          source: documented ? "Commandes de ce produit ayant fait l'objet d'un litige" : "Taux de litige de la plateforme",
          window: `${QUALITY_WINDOW_DAYS} jours`,
          sampleSize: documented ? orders90 : platformOrders90,
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
        {
          key: "stock_units",
          value: row.stock?.managed ? row.stock.units : null,
          unit: "count",
          source: row.stock?.managed ? "Stock déclaré par le fournisseur" : "Stock non géré pour ce produit",
          window: "maintenant",
          sampleSize: null,
          kind: "observed",
        },
      ],
      flags,
    })
  }

  const byEarnings = (a: RankedOpportunity, b: RankedOpportunity) =>
    b.observedNetEarnings30Cents - a.observedNetEarnings30Cents ||
    a.refundRateBps - b.refundRateBps ||
    a.productId.localeCompare(b.productId)
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200))
  const documentedList = scored.filter((s) => s.dataQuality === "documented").sort(byEarnings).slice(0, limit)
  const limitedList = scored.filter((s) => s.dataQuality === "limited").sort(byEarnings).slice(0, limit)
  noSalesData.sort((a, b) => b.resellerPayoutPerUnitCents - a.resellerPayoutPerUnitCents || a.productId.localeCompare(b.productId))

  return {
    documented: documentedList,
    limited: limitedList,
    ranked: [...documentedList, ...limitedList],
    noSalesData: noSalesData.slice(0, limit),
    platformRefundRateBps,
    platformOrders90,
  }
}
