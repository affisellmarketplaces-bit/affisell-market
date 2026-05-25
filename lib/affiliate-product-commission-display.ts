import { parseVariantsPayload, variantSkuPricingSummary } from "@/lib/product-variants"
import { maxAffiliateCommissionRatePct } from "@/lib/supplier-commission"

/** Commission % shown to affiliates (product field or max across SKU lines in `variants` JSON). */
export function affiliateCommissionDisplayPct(args: {
  commissionRate: number
  variants?: unknown
  basePriceCents?: number
}): number {
  const productRate = Math.min(100, Math.max(0, Math.round(Number(args.commissionRate) || 0)))
  const parsed = parseVariantsPayload(args.variants ?? null)
  const summary = variantSkuPricingSummary(parsed, Math.max(0, Math.round(args.basePriceCents ?? 0)))
  if (summary && summary.rows.length > 0) {
    return maxAffiliateCommissionRatePct([productRate, summary.commissionMax])
  }
  return productRate
}
