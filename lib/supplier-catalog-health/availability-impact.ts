/**
 * What an availability problem COSTS a supplier in its resellers' shops — measured, explained, fixable in one place
 * (founder brief 2026-11-19: « mesurer rapidement l'impact commercial d'un problème de disponibilité sur les boutiques
 * de ses revendeurs, comprendre sa cause et le corriger directement »). Pure, client-safe.
 *
 * Built from the catalogue-health issues (ONE diagnosis — nothing re-judged here) + what was observed on the product:
 * - shops = live reseller listings of the product (`AffiliateProduct.isListed`) — where buyers meet the problem;
 * - orders / units / supplier amount of the last 30 days and the last paid order — OBSERVED, before refunds, never a
 *   forecast (« ce que le produit faisait », never « ce que vous perdez »).
 * Only products that are in at least one reseller shop are listed: that is the commercial impact asked for.
 */
import type { HealthFix, HealthIssue, HealthIssueCode } from "@/lib/supplier-catalog-health/diagnose"

/** Codes that are about availability, most severe first (the first one present names the product's cause). */
export const AVAILABILITY_CODES = [
  "held_by_affisell",
  "stock_unconfirmed",
  "out_of_stock",
  "paused_but_listed",
  "variant_stock_untracked",
  "low_stock",
] as const satisfies ReadonlyArray<HealthIssueCode>

export type AvailabilityCode = (typeof AVAILABILITY_CODES)[number]

/** `blocked` = buyers can not buy it in those shops today; `at_risk` = still buyable, but not for long / not known. */
export const AVAILABILITY_SEVERITY: Record<AvailabilityCode, "blocked" | "at_risk"> = {
  held_by_affisell: "blocked",
  stock_unconfirmed: "blocked",
  out_of_stock: "blocked",
  paused_but_listed: "blocked",
  variant_stock_untracked: "at_risk",
  low_stock: "at_risk",
}

/** What the supplier can do from the panel. `reactivate` = lift its own pause (`PATCH /api/products/<id> {active}`). */
export type AvailabilityFix = Exclude<HealthFix, "none"> | "reactivate" | "none"

export type ProductSales = {
  paidOrders30d: number
  units30d: number
  /** Σ `Order.supplierPayoutCents` of the orders paid in 30 days — what the supplier was owed, before refunds. */
  supplierAmount30dCents: number
  /** Last paid order of the product, any date; null = never sold. */
  lastPaidAt: Date | null
}

export type AvailabilityImpactItem = {
  productId: string
  productName: string
  code: AvailabilityCode
  severity: "blocked" | "at_risk"
  /** Other availability codes on the same product (shown as « aussi »). */
  alsoCodes: AvailabilityCode[]
  evidence: HealthIssue["evidence"]
  shops: number
  paidOrders30d: number
  units30d: number
  supplierAmount30dCents: number
  lastPaidAt: string | null
  /** Whole days since the last paid order (null = never sold). */
  daysSinceLastSale: number | null
  fix: AvailabilityFix
}

export type AvailabilityImpact = {
  items: AvailabilityImpactItem[]
  totals: {
    blockedProducts: number
    /** Live reseller listings where a blocked product sits: buyers meet it there. */
    blockedShops: number
    atRiskProducts: number
    atRiskShops: number
    /** What the blocked products did in the last 30 days (observed). */
    blockedOrders30d: number
    blockedSupplierAmount30dCents: number
  }
}

const DAY = 86_400_000

function fixFor(issue: HealthIssue, code: AvailabilityCode): AvailabilityFix {
  if (code === "paused_but_listed") return "reactivate"
  return issue.fix === "none" ? "none" : issue.fix
}

export function buildAvailabilityImpact(
  issues: ReadonlyArray<HealthIssue>,
  sales: ReadonlyMap<string, ProductSales>,
  now: Date,
): AvailabilityImpact {
  const byProduct = new Map<string, HealthIssue[]>()
  for (const i of issues) {
    if (!(AVAILABILITY_CODES as ReadonlyArray<string>).includes(i.code)) continue
    if (i.demand.resellersListing <= 0) continue
    byProduct.set(i.productId, [...(byProduct.get(i.productId) ?? []), i])
  }

  const items: AvailabilityImpactItem[] = []
  for (const [productId, list] of byProduct) {
    const sorted = [...list].sort(
      (a, b) => AVAILABILITY_CODES.indexOf(a.code as AvailabilityCode) - AVAILABILITY_CODES.indexOf(b.code as AvailabilityCode),
    )
    const main = sorted[0]!
    const code = main.code as AvailabilityCode
    const s = sales.get(productId)
    const last = s?.lastPaidAt ?? null
    items.push({
      productId,
      productName: main.productName,
      code,
      severity: AVAILABILITY_SEVERITY[code],
      alsoCodes: sorted.slice(1).map((i) => i.code as AvailabilityCode),
      evidence: main.evidence,
      shops: main.demand.resellersListing,
      paidOrders30d: Math.max(0, s?.paidOrders30d ?? main.demand.paidOrders30d),
      units30d: Math.max(0, s?.units30d ?? 0),
      supplierAmount30dCents: Math.max(0, s?.supplierAmount30dCents ?? 0),
      lastPaidAt: last ? last.toISOString() : null,
      daysSinceLastSale: last ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / DAY)) : null,
      fix: fixFor(main, code),
    })
  }

  // Blocked first; then what the product was really doing (orders, amount), then how many shops show it.
  items.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "blocked" ? -1 : 1) ||
      b.paidOrders30d - a.paidOrders30d ||
      b.supplierAmount30dCents - a.supplierAmount30dCents ||
      b.shops - a.shops ||
      a.productName.localeCompare(b.productName),
  )

  const blocked = items.filter((i) => i.severity === "blocked")
  const atRisk = items.filter((i) => i.severity === "at_risk")
  return {
    items,
    totals: {
      blockedProducts: blocked.length,
      blockedShops: blocked.reduce((n, i) => n + i.shops, 0),
      atRiskProducts: atRisk.length,
      atRiskShops: atRisk.reduce((n, i) => n + i.shops, 0),
      blockedOrders30d: blocked.reduce((n, i) => n + i.paidOrders30d, 0),
      blockedSupplierAmount30dCents: blocked.reduce((n, i) => n + i.supplierAmount30dCents, 0),
    },
  }
}
