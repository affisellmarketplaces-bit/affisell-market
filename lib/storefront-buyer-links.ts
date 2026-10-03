/**
 * Buyer-flow links that differ between the Affisell marketplace and a reseller's own host.
 * Pure + client-safe (no Prisma): on a store host every link must stay on that host — the
 * platform routes (`/marketplace/*`, `/shops/browse`, `/login/customer`) are either blocked
 * there (redirected to affisell.com) or fall through to the store home.
 */

export type StorefrontHostContext = {
  /** True when the request is served on a reseller custom domain / store subdomain. */
  isStoreHost: boolean
  /** Reseller store display name (null on the platform). */
  storeName: string | null
}

export const PLATFORM_HOST_CONTEXT: StorefrontHostContext = { isStoreHost: false, storeName: null }

/** Product page: the store host serves `/product/:id`, the marketplace `/marketplace/:id`. */
export function buyerListingHref(listingId: string, isStoreHost: boolean): string {
  const id = encodeURIComponent(listingId)
  return isStoreHost ? `/product/${id}` : `/marketplace/${id}`
}

/** Where "continue shopping" / "discover products" goes. */
export function buyerContinueShoppingHref(isStoreHost: boolean): string {
  return isStoreHost ? "/" : "/shops/browse"
}

/** Cart empty-state "explore" link — the store catalogue on a store host. */
export function buyerExploreHref(isStoreHost: boolean): string {
  return isStoreHost ? "/" : "/#explorer"
}

/** Order follow-up: the store's own tracking page on a store host, the buyer account elsewhere. */
export function buyerOrdersHref(isStoreHost: boolean): string {
  return isStoreHost ? "/track-order" : "/marketplace/account/orders"
}

/** Buyer sign-in that returns to the right place. Store hosts use the store-scoped login. */
export function buyerSignInHref(isStoreHost: boolean): string {
  return isStoreHost
    ? `/login?callbackUrl=${encodeURIComponent("/track-order")}`
    : "/login/customer?callbackUrl=/marketplace/account/orders"
}

/** Post-purchase review deep link (writeReview opens the review form on the PDP). */
export function buyerReviewHref(
  affiliateProductId: string,
  orderId: string,
  isStoreHost: boolean
): string {
  const params = new URLSearchParams({ writeReview: "true", orderId })
  return `${buyerListingHref(affiliateProductId, isStoreHost)}?${params.toString()}`
}
