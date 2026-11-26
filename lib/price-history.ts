/**
 * Supplier price history — pure summaries (finalisation F1 / commercial intelligence A).
 *
 * The points come from `ProductPriceHistory`, written by a database trigger on every change of `Product.basePriceCents`
 * (migration 20261116200000_product_price_history). Nothing here estimates or extrapolates: every figure is computed from
 * recorded prices and says over which period and how many points. A product whose history started recently says so
 * (`coverageStartedAt`) instead of pretending its price was stable before.
 */
export type PricePoint = { priceCents: number; recordedAt: Date }

export type PriceWindowSummary = {
  days: number
  /** Price at the start of the window (last recorded price at or before it), or the first price inside it. */
  startCents: number | null
  endCents: number | null
  minCents: number | null
  maxCents: number | null
  /** Signed change end − start, in basis points of the start price (null when not computable). */
  changeBps: number | null
  /** Number of recorded changes inside the window. */
  changes: number
  /** False when the history begins after the window start: the window is only partly observed. */
  fullyObserved: boolean
}

export type PriceHistorySummary = {
  currentCents: number | null
  points: number
  coverageStartedAt: Date | null
  lastChangeAt: Date | null
  windows: PriceWindowSummary[]
  /** Plain-language verdict, derived from the 30-day window only; "insufficient_history" below 2 points. */
  trend: "insufficient_history" | "stable" | "rising" | "falling" | "volatile"
}

const DAY_MS = 24 * 60 * 60 * 1000
/** A move below 1 % is "stable"; 3+ changes in 30 days with both directions is "volatile". */
const STABLE_BPS = 100

function sortedPoints(points: PricePoint[]): PricePoint[] {
  return points
    .filter((p) => Number.isFinite(p.priceCents) && p.priceCents >= 0 && p.recordedAt instanceof Date && !Number.isNaN(p.recordedAt.getTime()))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
}

export function summarizeWindow(points: PricePoint[], days: number, now: Date): PriceWindowSummary {
  const sorted = sortedPoints(points)
  const start = now.getTime() - days * DAY_MS
  const before = sorted.filter((p) => p.recordedAt.getTime() <= start)
  const inside = sorted.filter((p) => p.recordedAt.getTime() > start && p.recordedAt.getTime() <= now.getTime())
  const anchor = before.length > 0 ? before[before.length - 1]! : null
  const series = anchor ? [anchor, ...inside] : inside
  if (series.length === 0) {
    return { days, startCents: null, endCents: null, minCents: null, maxCents: null, changeBps: null, changes: 0, fullyObserved: false }
  }
  const prices = series.map((p) => p.priceCents)
  const startCents = prices[0]!
  const endCents = prices[prices.length - 1]!
  let changes = 0
  for (let i = 1; i < prices.length; i++) if (prices[i] !== prices[i - 1]) changes++
  return {
    days,
    startCents,
    endCents,
    minCents: Math.min(...prices),
    maxCents: Math.max(...prices),
    changeBps: startCents > 0 ? Math.round(((endCents - startCents) / startCents) * 10_000) : null,
    changes,
    fullyObserved: anchor !== null,
  }
}

export function summarizePriceHistory(points: PricePoint[], now: Date = new Date()): PriceHistorySummary {
  const sorted = sortedPoints(points)
  const windows = [7, 30, 90].map((d) => summarizeWindow(sorted, d, now))
  const last = sorted[sorted.length - 1] ?? null

  let lastChangeAt: Date | null = null
  for (let i = sorted.length - 1; i > 0; i--) {
    if (sorted[i]!.priceCents !== sorted[i - 1]!.priceCents) {
      lastChangeAt = sorted[i]!.recordedAt
      break
    }
  }

  const w30 = windows[1]!
  let trend: PriceHistorySummary["trend"] = "insufficient_history"
  if (sorted.length >= 2 && w30.changeBps !== null) {
    const ups = countMoves(sorted, now, 30, 1)
    const downs = countMoves(sorted, now, 30, -1)
    if (w30.changes >= 3 && ups > 0 && downs > 0) trend = "volatile"
    else if (Math.abs(w30.changeBps) < STABLE_BPS) trend = "stable"
    else trend = w30.changeBps > 0 ? "rising" : "falling"
  }

  return {
    currentCents: last?.priceCents ?? null,
    points: sorted.length,
    coverageStartedAt: sorted[0]?.recordedAt ?? null,
    lastChangeAt,
    windows,
    trend,
  }
}

function countMoves(sorted: PricePoint[], now: Date, days: number, direction: 1 | -1): number {
  const start = now.getTime() - days * DAY_MS
  let n = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.recordedAt.getTime() <= start) continue
    const d = sorted[i]!.priceCents - sorted[i - 1]!.priceCents
    if (Math.sign(d) === direction) n++
  }
  return n
}
