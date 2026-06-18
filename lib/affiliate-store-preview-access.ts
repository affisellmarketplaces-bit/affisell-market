/** True when the signed-in user owns this affiliate storefront. */
export function isAffiliateStoreOwner(
  sessionUserId: string | null | undefined,
  storeUserId: string | null | undefined
): boolean {
  if (!sessionUserId || !storeUserId) return false
  return sessionUserId === storeUserId
}

export function isAffiliateOwnerPreviewUrl(
  searchParams: { get: (key: string) => string | null }
): boolean {
  return searchParams.get("preview") === "affiliate"
}

/** Owner-only preview chrome — never on the public buyer URL without explicit preview mode. */
export function shouldShowAffiliateStorePreviewBanner(
  isStoreOwner: boolean,
  isOwnerPreviewUrl: boolean
): boolean {
  return isStoreOwner && isOwnerPreviewUrl
}

/** Buyer PDP preview for an affiliate listing (listed or hidden draft on storefront). */
export function affiliateListingPreviewHref(args: {
  storeSlug: string | null | undefined
  listingId: string | null | undefined
  productId: string
}): string {
  const listingId = args.listingId?.trim()
  const storeSlug = args.storeSlug?.trim()
  if (listingId && storeSlug) {
    return `/shops/${encodeURIComponent(storeSlug)}/product/${encodeURIComponent(listingId)}?preview=affiliate`
  }
  if (listingId) {
    return `/marketplace/${encodeURIComponent(listingId)}?preview=affiliate`
  }
  return `/product/${encodeURIComponent(args.productId)}`
}
