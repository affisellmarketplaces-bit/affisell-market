/** Pure helpers for period-over-period revenue charts (client-safe). */

export type DayPoint = { day: string; revenueCents: number; orders: number }

export type ComparePoint = {
  /** ISO day of the current period. */
  day: string
  /** ISO day of the matching day of the previous period (same offset), null without comparison. */
  previousDay: string | null
  revenueCents: number
  previousCents: number | null
  orders: number
}

/** Align the previous period on the current one by position (day 1 ↔ day 1). Missing days count as 0. */
export function alignSeries(current: readonly DayPoint[], previous?: readonly DayPoint[] | null): ComparePoint[] {
  return current.map((row, i) => {
    const prev = previous ? previous[i] : undefined
    return {
      day: row.day,
      previousDay: previous ? (prev?.day ?? null) : null,
      revenueCents: row.revenueCents,
      previousCents: previous ? (prev?.revenueCents ?? 0) : null,
      orders: row.orders,
    }
  })
}

/** Running totals (current and previous) — readable when sales are sparse. */
export function toCumulative(rows: readonly ComparePoint[]): ComparePoint[] {
  let cur = 0
  let prev = 0
  return rows.map((r) => {
    cur += r.revenueCents
    if (r.previousCents != null) prev += r.previousCents
    return { ...r, revenueCents: cur, previousCents: r.previousCents == null ? null : prev }
  })
}

export function sumCents(points: readonly { revenueCents: number }[]): number {
  return points.reduce((s, p) => s + p.revenueCents, 0)
}

/** Days that actually had revenue. */
export function activeDays(points: readonly { revenueCents: number }[]): number {
  return points.filter((p) => p.revenueCents > 0).length
}

/**
 * Change vs the previous period, in percent (one decimal).
 * null = not comparable (previous is 0 but current is not → show "new"); 0 when both are 0.
 */
export function periodChangePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}
