/**
 * Supply ↔ demand opportunities by category — where Affisell should attract suppliers, restock or recruit resellers
 * (founder brief 2026-11-19, strategic exploration). Pure; INTERNAL (admin only).
 *
 * Per Google-taxonomy ROOT category, from Affisell's own records:
 *  - demand: paid orders of the last 30 days, resellers who sold in it, orders on products that are NOT sellable today;
 *  - supply: active products, products sellable today (same rule as the shops: `listingProblem` = none), suppliers with
 *    at least one sellable product, sellable products that no reseller lists.
 *
 * Three findings, each with its thresholds (minimum volumes so that one reseller or one order is never a "market"):
 *  - `under_supplied`       demand present (≥ 10 orders, ≥ 2 resellers) but thin sellable supply (≤ 3 products or ≤ 1
 *                           supplier) → recruit suppliers in that category;
 *  - `demand_on_unavailable` ≥ 5 orders AND ≥ 30 % of the category's orders went to products not sellable today → the
 *                           demand is there, the offer stopped: restock / source / replace;
 *  - `under_distributed`    ≥ 5 orders (the category sells), ≥ 10 sellable products and ≥ 60 % of them listed by no
 *                           reseller → recruit or activate resellers on that supply.
 * Searches without results and product requests without quotes are already in the cockpit (`unmet-demand.ts`) and are
 * reported beside these findings, not recomputed.
 *
 * Confidentiality: aggregates per category only — no reseller, supplier, product or price is named; counts of resellers
 * appear only when ≥ 2 (k-anonymity floor). Nothing is shown to suppliers or resellers.
 */

export const OPP_UNDER_SUPPLIED_MIN_ORDERS = 10
export const OPP_MIN_RESELLERS = 2
export const OPP_THIN_SUPPLY_PRODUCTS = 3
export const OPP_THIN_SUPPLY_SUPPLIERS = 1
export const OPP_UNAVAILABLE_MIN_ORDERS = 5
export const OPP_UNAVAILABLE_MIN_SHARE = 0.3
export const OPP_UNDERDIST_MIN_ORDERS = 5
export const OPP_UNDERDIST_MIN_SELLABLE = 10
export const OPP_UNDERDIST_MIN_UNLISTED_SHARE = 0.6

export type CategoryStats = {
  rootId: string
  label: string
  orders30d: number
  /** Orders of the last 30 days on products that are not sellable today. */
  ordersOnUnsellable30d: number
  /** Distinct resellers with a paid order in the category over 30 days. */
  sellingResellers: number
  activeProducts: number
  sellableProducts: number
  sellableSuppliers: number
  /** Sellable products listed by no reseller. */
  sellableNotListed: number
}

export type OpportunityKind = "under_supplied" | "demand_on_unavailable" | "under_distributed"

export type CatalogOpportunity = {
  kind: OpportunityKind
  rootId: string
  label: string
  /** What to do about it (closed list, worded by the page). */
  action: "recruit_suppliers" | "restock_or_source" | "recruit_resellers"
  /** Aggregates the finding rests on (no identifier). */
  evidence: Record<string, number>
  /** `medium` with twice the minimum volume, else `low`: these are leads, never a market size. */
  confidence: "low" | "medium"
  /** Ordering weight = orders concerned (observed). */
  weight: number
}

export function detectCatalogOpportunities(stats: ReadonlyArray<CategoryStats>): CatalogOpportunity[] {
  const out: CatalogOpportunity[] = []
  for (const c of stats) {
    const resellersShown = c.sellingResellers >= OPP_MIN_RESELLERS ? c.sellingResellers : 0
    if (
      c.orders30d >= OPP_UNDER_SUPPLIED_MIN_ORDERS &&
      c.sellingResellers >= OPP_MIN_RESELLERS &&
      (c.sellableProducts <= OPP_THIN_SUPPLY_PRODUCTS || c.sellableSuppliers <= OPP_THIN_SUPPLY_SUPPLIERS)
    ) {
      out.push({
        kind: "under_supplied",
        rootId: c.rootId,
        label: c.label,
        action: "recruit_suppliers",
        evidence: { orders30d: c.orders30d, resellers: resellersShown, sellableProducts: c.sellableProducts, sellableSuppliers: c.sellableSuppliers },
        confidence: c.orders30d >= 2 * OPP_UNDER_SUPPLIED_MIN_ORDERS ? "medium" : "low",
        weight: c.orders30d,
      })
    }
    const share = c.orders30d > 0 ? c.ordersOnUnsellable30d / c.orders30d : 0
    if (c.ordersOnUnsellable30d >= OPP_UNAVAILABLE_MIN_ORDERS && share >= OPP_UNAVAILABLE_MIN_SHARE) {
      out.push({
        kind: "demand_on_unavailable",
        rootId: c.rootId,
        label: c.label,
        action: "restock_or_source",
        evidence: { ordersOnUnsellable30d: c.ordersOnUnsellable30d, orders30d: c.orders30d, sharePct: Math.round(share * 100) },
        confidence: c.ordersOnUnsellable30d >= 2 * OPP_UNAVAILABLE_MIN_ORDERS ? "medium" : "low",
        weight: c.ordersOnUnsellable30d,
      })
    }
    const unlistedShare = c.sellableProducts > 0 ? c.sellableNotListed / c.sellableProducts : 0
    if (
      c.orders30d >= OPP_UNDERDIST_MIN_ORDERS &&
      c.sellableProducts >= OPP_UNDERDIST_MIN_SELLABLE &&
      unlistedShare >= OPP_UNDERDIST_MIN_UNLISTED_SHARE
    ) {
      out.push({
        kind: "under_distributed",
        rootId: c.rootId,
        label: c.label,
        action: "recruit_resellers",
        evidence: { orders30d: c.orders30d, sellableProducts: c.sellableProducts, sellableNotListed: c.sellableNotListed, unlistedPct: Math.round(unlistedShare * 100) },
        confidence: c.sellableProducts >= 2 * OPP_UNDERDIST_MIN_SELLABLE && c.orders30d >= 2 * OPP_UNDERDIST_MIN_ORDERS ? "medium" : "low",
        weight: c.orders30d,
      })
    }
  }
  const order: Record<OpportunityKind, number> = { under_supplied: 0, demand_on_unavailable: 1, under_distributed: 2 }
  return out.sort((a, b) => b.weight - a.weight || order[a.kind] - order[b.kind] || a.label.localeCompare(b.label))
}

/** Rolls per-product facts up to their taxonomy root (one definition of "root": follow `parentId` to the top). */
export function rootOfCategory(categoryId: string | null, parentOf: ReadonlyMap<string, string | null>): string | null {
  let cur = categoryId
  let guard = 0
  while (cur && parentOf.get(cur) && guard++ < 20) cur = parentOf.get(cur) ?? null
  return cur
}
