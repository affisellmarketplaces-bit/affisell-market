/**
 * Refund risk for the reseller copilot — PURE (no I/O), fed by the business journal (S2) counts.
 *
 * A product with three sales says almost nothing about its refund rate; its category, with hundreds,
 * says a lot. So the estimate is HIERARCHICAL (empirical Bayes, Beta–Binomial shrinkage):
 *
 *     category rate = (category refunds + W_cat × default) / (category purchases + W_cat)
 *     product rate  = (product refunds  + W_prod × category rate) / (product purchases + W_prod)
 *
 * — a product with no data takes its category's MEASURED rate, a category with no data takes the platform
 * default, and each level moves away from its parent only as fast as its own evidence allows. Every number
 * here is an estimate (`estimated: true`); nothing is invented: with no counts the result is exactly the default.
 */
import { DEFAULT_EXPECTED_REFUND_RATE } from "@/lib/reseller-margin-guard"

/** Pseudo-observations given to the parent level. Product: as in `smoothedRefundRate` (S2). */
export const PRODUCT_PRIOR_WEIGHT = 20
export const CATEGORY_PRIOR_WEIGHT = 50

export type RefundCounts = { purchases: number; refunds: number }

export type RefundRiskSource = "product" | "category" | "default"

export type RefundRiskEstimate = {
  /** Posterior mean refund rate (0–1) — what the margin guard uses. */
  rate: number
  /** Pessimistic rate (mean + 1 posterior sd, capped at 1) — used to rank risk, never to refuse. */
  upperRate: number
  /** Where most of the evidence comes from. */
  source: RefundRiskSource
  /** Own purchases of the product behind the estimate. */
  productPurchases: number
  /** 0–1: share of the estimate carried by the product's own sales (n / (n + W_prod)). */
  confidence: number
  estimated: true
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)

function normalise(c: RefundCounts | null | undefined): RefundCounts {
  const purchases = count(c?.purchases)
  return { purchases, refunds: Math.min(purchases, count(c?.refunds)) }
}

function shrink(c: RefundCounts, prior: number, weight: number): number {
  if (c.purchases + weight === 0) return prior
  return (c.refunds + weight * prior) / (c.purchases + weight)
}

/** Category-level rate (shrunk to the platform default). */
export function categoryRefundRate(
  counts: RefundCounts | null | undefined,
  options?: { defaultRate?: number; weight?: number },
): number {
  const prior = clamp01(options?.defaultRate ?? DEFAULT_EXPECTED_REFUND_RATE)
  return clamp01(shrink(normalise(counts), prior, Math.max(0, options?.weight ?? CATEGORY_PRIOR_WEIGHT)))
}

export function estimateRefundRisk(args: {
  product?: RefundCounts | null
  category?: RefundCounts | null
  defaultRate?: number
  productWeight?: number
  categoryWeight?: number
}): RefundRiskEstimate {
  const defaultRate = clamp01(args.defaultRate ?? DEFAULT_EXPECTED_REFUND_RATE)
  const cat = normalise(args.category)
  const prod = normalise(args.product)
  const wProd = Math.max(0, args.productWeight ?? PRODUCT_PRIOR_WEIGHT)
  const catRate = categoryRefundRate(cat, {
    defaultRate,
    weight: args.categoryWeight,
  })
  const rate = clamp01(shrink(prod, catRate, wProd))
  // Beta posterior with α = refunds + W·prior, β = (purchases − refunds) + W·(1 − prior): sd = √(p(1−p)/(n+W+1)).
  const sd = Math.sqrt((rate * (1 - rate)) / (prod.purchases + wProd + 1))
  const confidence = prod.purchases + wProd > 0 ? prod.purchases / (prod.purchases + wProd) : 0
  const source: RefundRiskSource =
    prod.purchases >= wProd ? "product" : cat.purchases > 0 || prod.purchases > 0 ? "category" : "default"
  return {
    rate,
    upperRate: clamp01(rate + sd),
    source: prod.purchases === 0 && cat.purchases === 0 ? "default" : source,
    productPurchases: prod.purchases,
    confidence,
    estimated: true,
  }
}

export type RefundTrend = {
  /** True when the recent rate is above the baseline beyond chance (one-sided z ≥ {@link REFUND_TREND_MIN_Z}). */
  rising: boolean
  recentRate: number
  baselineRate: number
  z: number
}

/** Minimum sales in EACH window before a trend is reported — below that, any "trend" is noise. */
export const REFUND_TREND_MIN_PURCHASES = 15
export const REFUND_TREND_MIN_Z = 2
/** And the rise must matter commercially, not only statistically. */
export const REFUND_TREND_MIN_DELTA = 0.05

/**
 * Has a product started being refunded more? Two-proportion z-test, recent window vs baseline window
 * (counts from the journal). Returns null when either window has too few sales to say anything.
 */
export function detectRefundTrend(recent: RefundCounts, baseline: RefundCounts): RefundTrend | null {
  const r = normalise(recent)
  const b = normalise(baseline)
  if (r.purchases < REFUND_TREND_MIN_PURCHASES || b.purchases < REFUND_TREND_MIN_PURCHASES) return null
  const p1 = r.refunds / r.purchases
  const p0 = b.refunds / b.purchases
  const pooled = (r.refunds + b.refunds) / (r.purchases + b.purchases)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / r.purchases + 1 / b.purchases))
  const z = se > 0 ? (p1 - p0) / se : 0
  return {
    rising: z >= REFUND_TREND_MIN_Z && p1 - p0 >= REFUND_TREND_MIN_DELTA,
    recentRate: p1,
    baselineRate: p0,
    z,
  }
}
