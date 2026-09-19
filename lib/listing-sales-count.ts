import { bcp47ForAppLocale } from "@/lib/app-locale-format"
import { isAppLocale } from "@/lib/i18n-locale"

/** Listing sales counts for buyer-facing social proof (no Prisma). */

export function normalizeListingSalesCount(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

/** Below this, "3 sales" hurts trust more than it helps — show nothing rather than a weak number. */
export const SALES_MIN_DISPLAY = 5

export function shouldShowBuyerSalesCount(count: number): boolean {
  return normalizeListingSalesCount(count) >= SALES_MIN_DISPLAY
}

/**
 * Marketplace-style rounding: exact up to 49, then "50+", "100+", "250+", "500+", "1000+", "2000+"…
 * Never overstates (always rounds down), so the badge stays truthful as sales grow.
 */
export function bucketSalesCount(count: number): { value: number; plus: boolean } {
  const n = normalizeListingSalesCount(count)
  if (n < 50) return { value: n, plus: false }
  const steps = [50, 100, 250, 500, 1000]
  for (let i = steps.length - 1; i >= 0; i--) if (n >= steps[i]!) {
    if (steps[i] === 1000) return { value: Math.floor(n / 1000) * 1000, plus: true }
    return { value: steps[i]!, plus: true }
  }
  return { value: n, plus: false }
}

export type SalesStats = {
  /** Confirmed units (paid, not cancelled/refunded), all time. */
  units: number
  units7d?: number
  units24h?: number
  /** ISO date of the latest confirmed sale. */
  lastPaidAt?: string | null
}

export type SalesDisplay =
  | { kind: "day"; count: number; plus: false }
  | { kind: "week"; count: number; plus: false }
  | { kind: "total"; count: number; plus: boolean }

/**
 * Pick the most compelling TRUE statement: today's momentum, else this week's, else the (rounded) total.
 * Returns null when no honest number is impressive enough.
 */
export function resolveSalesDisplay(stats: SalesStats): SalesDisplay | null {
  const day = normalizeListingSalesCount(stats.units24h)
  if (day >= 3) return { kind: "day", count: day, plus: false }
  const week = normalizeListingSalesCount(stats.units7d)
  if (week >= SALES_MIN_DISPLAY) return { kind: "week", count: week, plus: false }
  const total = normalizeListingSalesCount(stats.units)
  if (total >= SALES_MIN_DISPLAY) {
    const b = bucketSalesCount(total)
    return { kind: "total", count: b.value, plus: b.plus }
  }
  return null
}

/** "Last purchase 12 min ago": only within the last 24 h, and never in the future. */
export function lastSaleAgo(
  lastPaidAt: string | Date | null | undefined,
  now: number = Date.now()
): { value: number; unit: "minute" | "hour" } | null {
  if (!lastPaidAt) return null
  const t = new Date(lastPaidAt).getTime()
  if (!Number.isFinite(t)) return null
  const mins = Math.floor((now - t) / 60_000)
  if (mins < 0 || mins >= 24 * 60) return null
  if (mins < 60) return { value: Math.max(1, mins), unit: "minute" }
  return { value: Math.floor(mins / 60), unit: "hour" }
}

/** Compact number for badges (e.g. 1.2k). */
export function formatSalesCountCompact(count: number, locale: string): string {
  const n = normalizeListingSalesCount(count)
  const loc = bcp47ForAppLocale(isAppLocale(locale) ? locale : "en")
  if (n >= 10_000) {
    return new Intl.NumberFormat(loc, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)
  }
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(n)
}

export const SALES_COUNT_POPULAR_THRESHOLD = 50

export function isPopularSalesCount(count: number): boolean {
  return normalizeListingSalesCount(count) >= SALES_COUNT_POPULAR_THRESHOLD
}
