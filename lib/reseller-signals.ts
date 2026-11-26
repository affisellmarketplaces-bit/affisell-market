/**
 * Commercial signals for the reseller copilot — PURE, explainable, and silent without enough data.
 *
 * Each detector answers one question with a plain statistical test on REAL counts (paid orders, supplier prices
 * actually charged), returns the numbers it used so the UI can say WHY, and returns null when the sample is too small
 * to conclude. Nothing here forecasts a number; it flags a change that is unlikely to be chance.
 */

// ─── Demand momentum: is a product selling faster than before? ─────────────────────────────────────────────────────

export const MOMENTUM_MIN_RECENT_UNITS = 5
export const MOMENTUM_MIN_RATIO = 1.5
/** One-sided z for a Poisson count (≈ p < 0.01). */
export const MOMENTUM_MIN_Z = 2.33

export type DemandMomentum = {
  rising: boolean
  recentUnits: number
  /** Units expected in the recent window at the previous pace. */
  expectedUnits: number
  ratio: number
  z: number
}

/**
 * Poisson test: units sold in the recent window vs what the previous window's pace predicts for the same length.
 * A product with no previous sales is "new demand" (ratio = Infinity) once it reaches the minimum.
 */
export function detectDemandMomentum(args: {
  recentUnits: number
  recentDays: number
  previousUnits: number
  previousDays: number
}): DemandMomentum | null {
  const recent = Math.max(0, Math.floor(args.recentUnits))
  const previous = Math.max(0, Math.floor(args.previousUnits))
  if (recent < MOMENTUM_MIN_RECENT_UNITS || args.recentDays <= 0 || args.previousDays <= 0) return null
  // Previous pace, floored at one unit over the previous window: "never sold before" is not "infinitely rare".
  const expected = (Math.max(previous, 1) * args.recentDays) / args.previousDays
  const z = (recent - expected) / Math.sqrt(expected)
  const ratio = previous === 0 ? Number.POSITIVE_INFINITY : recent / expected
  return {
    rising: z >= MOMENTUM_MIN_Z && ratio >= MOMENTUM_MIN_RATIO,
    recentUnits: recent,
    expectedUnits: expected,
    ratio,
    z,
  }
}

// ─── Supplier cost drift: is the supplier's price today out of line with what it charged? ─────────────────────────

export const COST_DRIFT_MIN_OBSERVATIONS = 3
export const COST_DRIFT_MIN_CHANGE = 0.1
/** Robust z (median / MAD) above which a price is an outlier for this product. */
export const COST_DRIFT_MIN_ROBUST_Z = 3

export type CostDrift = {
  drifted: boolean
  direction: "up" | "down"
  currentUnitCents: number
  medianUnitCents: number
  change: number
  observations: number
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * Today's supplier unit price vs the unit prices actually charged on paid orders (same SKU, base variant).
 * Robust to one odd order (median + MAD). With a perfectly stable history, any change ≥ 10 % is a drift.
 */
export function detectCostDrift(args: {
  currentUnitCents: number
  historyUnitCents: readonly number[]
}): CostDrift | null {
  const history = args.historyUnitCents.filter((v) => Number.isFinite(v) && v > 0)
  const current = args.currentUnitCents
  if (history.length < COST_DRIFT_MIN_OBSERVATIONS || !(current > 0)) return null
  const med = median(history)
  const mad = median(history.map((v) => Math.abs(v - med)))
  const change = (current - med) / med
  const robustZ = mad > 0 ? Math.abs(current - med) / (1.4826 * mad) : Number.POSITIVE_INFINITY
  return {
    drifted: Math.abs(change) >= COST_DRIFT_MIN_CHANGE && robustZ >= COST_DRIFT_MIN_ROBUST_Z,
    direction: change >= 0 ? "up" : "down",
    currentUnitCents: current,
    medianUnitCents: Math.round(med),
    change,
    observations: history.length,
  }
}

// ─── Popularity without profit ─────────────────────────────────────────────────────────────────────────────────────

export const TRAFFIC_MIN_CLICKS = 100
export const TRAFFIC_MAX_CONVERSION = 0.005

/** A listing that gets visits but (almost) never sells — attention the reseller pays for without earning. */
export function detectTrafficWithoutSales(args: { clicks: number; conversions: number }): {
  flagged: boolean
  clicks: number
  conversionRate: number
} | null {
  const clicks = Math.max(0, Math.floor(args.clicks))
  if (clicks < TRAFFIC_MIN_CLICKS) return null
  const conversionRate = Math.max(0, Math.floor(args.conversions)) / clicks
  return { flagged: conversionRate < TRAFFIC_MAX_CONVERSION, clicks, conversionRate }
}
