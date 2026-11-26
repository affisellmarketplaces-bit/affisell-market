import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { evaluateMarginGuard, type MarginGuardLevel } from "@/lib/reseller-margin-guard"

/**
 * ANTICIPATED loss of profitability — before it happens. Pure, client-safe.
 *
 * The cost-drift signal (reseller-signals.ts) says a supplier price HAS jumped. This module looks at the trend of the
 * supplier's unit price over time and answers, for a listing that is still HEALTHY today: « if this trend continues and
 * you change nothing, in how many days does this product become thin, then unprofitable — and what would it pay in 30
 * days? ». It is a projection of an observed trend, never a promise, and it says so (`estimated: true`).
 *
 * Method (deliberately simple and robust, every step checkable):
 *  1. Observations = supplier unit price on each paid order (base SKU), reduced to ONE value per day (the day's median),
 *     so a day with 40 orders does not outweigh a day with one.
 *  2. Trend = Theil–Sen slope (median of all pairwise slopes, cents/day): insensitive to outliers and promotions.
 *     Its one-sided 95 % confidence bound comes from Kendall's S distribution (Sen 1968, Gilbert 1987). A forecast is
 *     made ONLY when the LOWER bound is above zero: the rise is established, not a noisy wiggle.
 *  3. Projection = today's supplier price + slope × days (the point trend; the pessimistic upper bound is reported
 *     beside it). Each projected price goes through the SAME net calculation as the settlement
 *     (`buildAffiliateCatalogCardEconomics`, PR #17) and the SAME margin guard as every reseller surface, with the
 *     listing's own selling price, fee and expected refund rate — no second financial model.
 *  4. Days until the guard level changes = binary search over the horizon (the net falls monotonically as the cost
 *     rises at a fixed selling price).
 *
 * Gates: ≥ {@link EROSION_MIN_DAYS} distinct days of observations spanning ≥ {@link EROSION_MIN_SPAN_DAYS} days, the
 * listing healthy today, and the thin level reached within {@link EROSION_HORIZON_DAYS} days by the point trend.
 * Calibrated by a test: on flat noisy prices the false-alarm rate stays under 5 %.
 */
export const EROSION_MIN_DAYS = 6
export const EROSION_MIN_SPAN_DAYS = 21
export const EROSION_HORIZON_DAYS = 60
export const EROSION_PROJECTION_DAYS = 30
/** z for a one-sided 95 % bound. */
const Z_ONE_SIDED_95 = 1.6449
const DAY_MS = 86_400_000

export type CostObservation = { at: Date | number; unitCents: number }

export type MarginErosionInput = {
  observations: readonly CostObservation[]
  /** Supplier price today (the anchor of the projection). */
  supplierPriceCents: number
  sellingPriceCents: number
  commissionRatePct: number
  resellerFeeBps: number | null
  expectedRefundRate: number
  now?: Date
}

export type MarginErosionForecast = {
  /** Theil–Sen slope of the supplier unit price, cents per day, and its one-sided 95 % bounds. */
  slopeCentsPerDay: number
  slopeLowerCentsPerDay: number
  slopeUpperCentsPerDay: number
  observationDays: number
  spanDays: number
  levelNow: MarginGuardLevel
  expectedNetNowCents: number
  /** Expected net per sale in {@link EROSION_PROJECTION_DAYS} days if the trend continues and nothing changes. */
  expectedNetProjectedCents: number
  projectedSupplierPriceCents: number
  /** Days until « thin » / « insufficient » with the point trend; null = not within the horizon. */
  daysToThin: number | null
  daysToInsufficient: number | null
  /** Same, with the upper (pessimistic) slope bound. */
  daysToThinPessimistic: number | null
  estimated: true
}

const finitePositive = (n: number) => Number.isFinite(n) && n > 0

function median(sorted: readonly number[]): number {
  const m = sorted.length >> 1
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2
}

/** One value per calendar day (UTC): the day's median unit price. */
export function dailyMedians(observations: readonly CostObservation[]): Array<{ day: number; cents: number }> {
  const byDay = new Map<number, number[]>()
  for (const o of observations) {
    const t = typeof o.at === "number" ? o.at : o.at.getTime()
    if (!Number.isFinite(t) || !finitePositive(o.unitCents)) continue
    const day = Math.floor(t / DAY_MS)
    const list = byDay.get(day) ?? []
    list.push(o.unitCents)
    byDay.set(day, list)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, values]) => ({ day, cents: median([...values].sort((x, y) => x - y)) }))
}

/**
 * Theil–Sen slope with Sen's confidence bounds (Kendall's S variance, ties ignored — daily medians of prices rarely
 * tie exactly on BOTH axes, and ignoring ties only widens the interval).
 */
export function theilSen(points: ReadonlyArray<{ x: number; y: number }>, z = Z_ONE_SIDED_95) {
  const n = points.length
  const slopes: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[j]!.x - points[i]!.x
      if (dx !== 0) slopes.push((points[j]!.y - points[i]!.y) / dx)
    }
  }
  if (slopes.length === 0) return null
  slopes.sort((a, b) => a - b)
  const N = slopes.length
  const varS = (n * (n - 1) * (2 * n + 5)) / 18
  const c = z * Math.sqrt(varS)
  const lowerIdx = Math.max(0, Math.floor((N - c) / 2) - 1)
  const upperIdx = Math.min(N - 1, Math.ceil((N + c) / 2))
  return { slope: median(slopes), lower: slopes[lowerIdx]!, upper: slopes[upperIdx]! }
}

function levelAt(input: MarginErosionInput, supplierPriceCents: number) {
  const eco = buildAffiliateCatalogCardEconomics(Math.max(0, Math.round(supplierPriceCents)), input.commissionRatePct, {
    listedSellingPriceCents: input.sellingPriceCents,
    resellerFeeBps: input.resellerFeeBps,
  })
  return evaluateMarginGuard({
    netGainCents: eco.netPartnerGainCents,
    clientPriceCents: input.sellingPriceCents,
    expectedRefundRate: input.expectedRefundRate,
  })
}

const WORSE: Record<MarginGuardLevel, number> = { healthy: 0, thin: 1, insufficient: 2 }

/** Smallest whole day d in [1, horizon] at which the level is at least `target`, or null. */
function daysUntil(
  input: MarginErosionInput,
  slope: number,
  target: MarginGuardLevel,
  horizon = EROSION_HORIZON_DAYS,
): number | null {
  if (!(slope > 0)) return null
  const reached = (d: number) => WORSE[levelAt(input, input.supplierPriceCents + slope * d).level] >= WORSE[target]
  if (!reached(horizon)) return null
  let lo = 1
  let hi = horizon
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (reached(mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** Null unless a rising supplier cost is ESTABLISHED and turns a healthy listing thin within the horizon. */
export function forecastMarginErosion(input: MarginErosionInput): MarginErosionForecast | null {
  if (!finitePositive(input.supplierPriceCents) || !finitePositive(input.sellingPriceCents)) return null
  const days = dailyMedians(input.observations)
  if (days.length < EROSION_MIN_DAYS) return null
  const spanDays = days[days.length - 1]!.day - days[0]!.day
  if (spanDays < EROSION_MIN_SPAN_DAYS) return null
  const ts = theilSen(days.map((d) => ({ x: d.day, y: d.cents })))
  if (!ts || !(ts.lower > 0)) return null

  const now = levelAt(input, input.supplierPriceCents)
  if (now.level !== "healthy") return null // already thin / insufficient: the plan's other actions cover it
  const daysToThin = daysUntil(input, ts.slope, "thin")
  if (daysToThin == null) return null

  const projectedSupplierPriceCents = Math.round(input.supplierPriceCents + ts.slope * EROSION_PROJECTION_DAYS)
  return {
    slopeCentsPerDay: ts.slope,
    slopeLowerCentsPerDay: ts.lower,
    slopeUpperCentsPerDay: ts.upper,
    observationDays: days.length,
    spanDays,
    levelNow: now.level,
    expectedNetNowCents: now.expectedNetCents,
    expectedNetProjectedCents: levelAt(input, projectedSupplierPriceCents).expectedNetCents,
    projectedSupplierPriceCents,
    daysToThin,
    daysToInsufficient: daysUntil(input, ts.slope, "insufficient"),
    daysToThinPessimistic: daysUntil(input, ts.upper, "thin"),
    estimated: true,
  }
}
