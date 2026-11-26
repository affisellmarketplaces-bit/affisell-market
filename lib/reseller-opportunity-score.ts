/**
 * Opportunity ranking and listing health for the reseller copilot — PURE (no I/O).
 *
 * Ranking: what a reseller should expect to EARN from pushing a product, not what it looks like it earns:
 *
 *     score = risk-adjusted expected net per sale × demand index × supplier reliability
 *
 * - expected net per sale: the margin guard's figure (net after Affisell's fee, minus expected refunds) at the
 *   PESSIMISTIC refund rate (`upperRate`), so a product with little history is ranked prudently;
 * - demand index: 1 + ln(1 + paid sales in the window) — logarithmic so a best-seller does not crush everything
 *   and a product with no sales yet still ranks on its economics (index 1, never 0);
 * - supplier reliability: 1 − the supplier's smoothed refund rate (journal), neutral (1) when unknown.
 *
 * Every input is a measured count or a figure the settlement functions compute; nothing is invented. The score
 * orders products, it is NOT a forecast of earnings, and every output carries `estimated: true`.
 */
import { evaluateMarginGuard, isRecommendable, type MarginGuardVerdict } from "@/lib/reseller-margin-guard"
import type { RefundRiskEstimate, RefundTrend } from "@/lib/reseller-refund-risk"

export type OpportunityInput = {
  productId: string
  /** `economics.netPartnerGainCents` (after Affisell's reseller fee). */
  netGainCents: number
  clientPriceCents: number
  refundRisk: RefundRiskEstimate
  /** Paid sales of the product in the demand window (journal `purchase` events). */
  recentPurchases?: number | null
  /** Supplier's smoothed refund rate (journal), when measured. */
  supplierRefundRate?: number | null
  /**
   * Supplier reliability multiplier from the reliability index (`reliabilityMultiplier`, 0.5–1.2, 1 when not usable).
   * When given, it replaces the refund-rate fallback.
   */
  supplierMultiplier?: number | null
}

export type OpportunityScore = {
  productId: string
  score: number
  /** Guard verdict at the MEAN refund rate — the one that decides whether a product may be recommended. */
  guard: MarginGuardVerdict
  /** Expected net at the pessimistic refund rate (cents). */
  riskAdjustedNetCents: number
  demandIndex: number
  supplierReliability: number
  recommendable: boolean
  estimated: true
}

const nonNeg = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0)

export function demandIndex(recentPurchases: number | null | undefined): number {
  return 1 + Math.log1p(Math.floor(nonNeg(recentPurchases)))
}

export function supplierReliability(supplierRefundRate: number | null | undefined): number {
  if (typeof supplierRefundRate !== "number" || !Number.isFinite(supplierRefundRate)) return 1
  return 1 - Math.min(1, Math.max(0, supplierRefundRate))
}

export function scoreOpportunity(input: OpportunityInput): OpportunityScore {
  const guard = evaluateMarginGuard({
    netGainCents: input.netGainCents,
    clientPriceCents: input.clientPriceCents,
    expectedRefundRate: input.refundRisk.rate,
  })
  const pessimistic = evaluateMarginGuard({
    netGainCents: input.netGainCents,
    clientPriceCents: input.clientPriceCents,
    expectedRefundRate: input.refundRisk.upperRate,
  })
  const d = demandIndex(input.recentPurchases)
  const rel =
    typeof input.supplierMultiplier === "number" && Number.isFinite(input.supplierMultiplier)
      ? input.supplierMultiplier
      : supplierReliability(input.supplierRefundRate)
  const recommendable = isRecommendable(guard)
  return {
    productId: input.productId,
    score: recommendable ? Math.max(0, pessimistic.expectedNetCents) * d * rel : 0,
    guard,
    riskAdjustedNetCents: pessimistic.expectedNetCents,
    demandIndex: d,
    supplierReliability: rel,
    recommendable,
    estimated: true,
  }
}

/** Recommendable first, then score (desc), then product id — a total, stable order. */
export function rankOpportunities(scores: readonly OpportunityScore[]): OpportunityScore[] {
  return [...scores].sort(
    (a, b) =>
      Number(b.recommendable) - Number(a.recommendable) || b.score - a.score || a.productId.localeCompare(b.productId),
  )
}

// ─── Listing health: the products a reseller ALREADY sells ────────────────────────────────────────────────

export type ListingHealthIssue =
  /** The supplier's price is now at or above the reseller's selling price: no markup left on this listing. */
  | "supplier_price_at_or_above_selling"
  /** At the reseller's own price, the expected net is below the guard's floor. */
  | "net_insufficient"
  /** Recommended, but thin (guard "thin"). */
  | "net_thin"
  /** Refunds on this product rose beyond chance recently (see `detectRefundTrend`). */
  | "refund_rate_rising"

export type ListingHealthInput = {
  listingId: string
  productId: string
  sellingPriceCents: number
  supplierPriceCents: number
  /** `economics.netPartnerGainCents` computed AT THE RESELLER'S SELLING PRICE. */
  netGainCents: number
  refundRisk: RefundRiskEstimate
  refundTrend?: RefundTrend | null
}

export type ListingHealth = {
  listingId: string
  productId: string
  status: "ok" | "watch" | "action"
  issues: ListingHealthIssue[]
  guard: MarginGuardVerdict
  estimated: true
}

export function evaluateListingHealth(input: ListingHealthInput): ListingHealth {
  const guard = evaluateMarginGuard({
    netGainCents: input.netGainCents,
    clientPriceCents: input.sellingPriceCents,
    expectedRefundRate: input.refundRisk.rate,
  })
  const issues: ListingHealthIssue[] = []
  if (input.supplierPriceCents > 0 && input.supplierPriceCents >= input.sellingPriceCents) {
    issues.push("supplier_price_at_or_above_selling")
  }
  if (guard.level === "insufficient") issues.push("net_insufficient")
  else if (guard.level === "thin") issues.push("net_thin")
  if (input.refundTrend?.rising) issues.push("refund_rate_rising")
  const action = issues.some((i) => i !== "net_thin")
  return {
    listingId: input.listingId,
    productId: input.productId,
    status: action ? "action" : issues.length > 0 ? "watch" : "ok",
    issues,
    guard,
    estimated: true,
  }
}

const STATUS_ORDER = { action: 0, watch: 1, ok: 2 } as const

/** Most urgent first, then lowest expected net — the order a reseller should review them in. */
export function sortListingHealth(rows: readonly ListingHealth[]): ListingHealth[] {
  return [...rows].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.guard.expectedNetCents - b.guard.expectedNetCents ||
      a.listingId.localeCompare(b.listingId),
  )
}
