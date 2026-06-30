import { bcp47ForAppLocale } from "@/lib/app-locale-format"
import { isAppLocale } from "@/lib/i18n-locale"

/** Listing sales counts for buyer-facing social proof (no Prisma). */

export function normalizeListingSalesCount(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

export function shouldShowBuyerSalesCount(count: number): boolean {
  return normalizeListingSalesCount(count) > 0
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
