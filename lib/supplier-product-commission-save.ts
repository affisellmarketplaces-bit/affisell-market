import type { ListingKind } from "@/lib/supplier-commission"
import {
  maxAffiliateCommissionRatePct,
  normalizeAffiliateCommissionRatePct,
} from "@/lib/supplier-commission"
import { validateExplicitSupplierCommissionForPublish } from "@/lib/supplier-explicit-commission"

export function productCommissionRateForSave(args: {
  topLevelRaw: unknown
  variantCommissionRates?: number[]
  listingKind: ListingKind
  /** Used when the top-level field is omitted and there are no per-SKU rates (e.g. partial PUT). */
  fallbackRate?: number
  /** When true (publish), commission must be > 0 on product or every SKU line (except donation). */
  requireExplicit?: boolean
  offerMode?: string | null
}): { ok: true; rate: number } | { ok: false; error: string } {
  const variantRates = args.variantCommissionRates ?? []
  const topFinite = Number.isFinite(Number(args.topLevelRaw))
    ? Math.round(Number(args.topLevelRaw))
    : null

  let normalized: { ok: true; rate: number } | { ok: false; error: string }

  if (variantRates.length > 0) {
    const combined = maxAffiliateCommissionRatePct([
      topFinite ?? 0,
      ...variantRates.map((r) => Math.round(Number(r) || 0)),
    ])
    normalized = normalizeAffiliateCommissionRatePct(combined, args.listingKind)
  } else if (topFinite == null) {
    const fallback = Math.round(Number(args.fallbackRate))
    if (Number.isFinite(fallback) && fallback >= 0) {
      normalized = normalizeAffiliateCommissionRatePct(fallback, args.listingKind)
    } else {
      normalized = { ok: true, rate: 0 }
    }
  } else {
    normalized = normalizeAffiliateCommissionRatePct(topFinite, args.listingKind)
  }

  if (!normalized.ok) return normalized

  if (args.requireExplicit) {
    const publishCheck = validateExplicitSupplierCommissionForPublish({
      resolvedRate: normalized.rate,
      variantCommissionRates: variantRates,
      offerMode: args.offerMode,
    })
    if (!publishCheck.ok) return publishCheck
  }

  return normalized
}
