/** Markup stored on AffiliateProduct = selling anchor − supplier catalog base (HT). */
export function computeAffiliateListingMarginCents(
  sellingPriceCents: number,
  supplierBasePriceCents: number
): number {
  return Math.max(
    0,
    Math.round(sellingPriceCents) - Math.round(supplierBasePriceCents)
  )
}
