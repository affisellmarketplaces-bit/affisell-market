/** Client-safe — listing row on a discover catalog product. */
export type CatalogAffiliateListingRow = {
  id: string
  isListed: boolean
  sellingPriceCents?: number
  /** Storefront engagement — used to distinguish draft vs previously live. */
  clicks?: number
  conversions?: number
}

export type CatalogListingState =
  | { kind: "none" }
  /** Draft / invitation / never shown live — first publish, not a relist. */
  | { kind: "ready"; listingId: string }
  | { kind: "live"; listingId: string }
  /** Soft-hidden after having been live (or with storefront signal). */
  | { kind: "hidden"; listingId: string }

/** True when the listing likely appeared on the public storefront before. */
export function listingWasEverStorefrontLive(row: CatalogAffiliateListingRow): boolean {
  return (row.clicks ?? 0) > 0 || (row.conversions ?? 0) > 0
}

export function resolveCatalogListingState(
  affiliateProducts?: CatalogAffiliateListingRow[] | null
): CatalogListingState {
  if (!affiliateProducts?.length) return { kind: "none" }
  const live = affiliateProducts.find((a) => a.isListed)
  if (live) return { kind: "live", listingId: live.id }
  const draft = affiliateProducts[0]!
  if (listingWasEverStorefrontLive(draft)) {
    return { kind: "hidden", listingId: draft.id }
  }
  return { kind: "ready", listingId: draft.id }
}
