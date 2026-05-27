/** Client-safe — listing row on a discover catalog product. */
export type CatalogAffiliateListingRow = {
  id: string
  isListed: boolean
}

export type CatalogListingState =
  | { kind: "none" }
  | { kind: "live"; listingId: string }
  | { kind: "hidden"; listingId: string }

export function resolveCatalogListingState(
  affiliateProducts?: CatalogAffiliateListingRow[] | null
): CatalogListingState {
  if (!affiliateProducts?.length) return { kind: "none" }
  const live = affiliateProducts.find((a) => a.isListed)
  if (live) return { kind: "live", listingId: live.id }
  return { kind: "hidden", listingId: affiliateProducts[0]!.id }
}
