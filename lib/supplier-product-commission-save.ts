import type { ListingKind } from "@/lib/supplier-commission"
import {
  maxAffiliateCommissionRatePct,
  normalizeAffiliateCommissionRatePct,
} from "@/lib/supplier-commission"

export function productCommissionRateForSave(args: {
  topLevelRaw: unknown
  variantCommissionRates?: number[]
  listingKind: ListingKind
  /** Used when the top-level field is omitted and there are no per-SKU rates (e.g. partial PUT). */
  fallbackRate?: number
}): { ok: true; rate: number } | { ok: false; error: string } {
  const variantRates = args.variantCommissionRates ?? []
  const topFinite = Number.isFinite(Number(args.topLevelRaw))
    ? Math.round(Number(args.topLevelRaw))
    : null

  if (variantRates.length > 0) {
    const combined = maxAffiliateCommissionRatePct([
      topFinite ?? 0,
      ...variantRates.map((r) => Math.round(Number(r) || 0)),
    ])
    return normalizeAffiliateCommissionRatePct(combined, args.listingKind)
  }

  if (topFinite == null) {
    const fallback = Math.round(Number(args.fallbackRate))
    if (Number.isFinite(fallback) && fallback >= 0) {
      return normalizeAffiliateCommissionRatePct(fallback, args.listingKind)
    }
    return { ok: true, rate: 0 }
  }
  return normalizeAffiliateCommissionRatePct(topFinite, args.listingKind)
}
