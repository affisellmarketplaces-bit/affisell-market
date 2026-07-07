/** Affiliate product discovery (margins, commissions) — not the public buyer marketplace. */
import { listingPublicSegment } from "@/lib/listing-public-url-shared"
export const AFFILIATE_CATALOG_PATH = "/dashboard/affiliate/catalog"

/** Swipe Feed hub — Tinder-style product discovery & one-tap listing. */
export const AFFILIATE_HUB_PATH = "/dashboard/affiliate/hub"

/** Agent IA sourcing (marges, choix SKU vitrine) — pas l’agent shopping acheteur `/agent`. */
export const AFFILIATE_AGENT_PATH = "/dashboard/affiliate/agent"

/** Public buyer directory and storefronts. */
export const PUBLIC_SHOPS_PATH = "/shops"

/** Cross-store product browse for buyers (no margins / commissions). */
export const PUBLIC_MARKETPLACE_BROWSE_PATH = "/shops/browse"

export function shopStorefrontPath(slug: string): string {
  return `${PUBLIC_SHOPS_PATH}/${encodeURIComponent(slug)}`
}

export function shopListingPath(
  storeSlug: string,
  listingId: string,
  customSlug?: string | null
): string {
  const segment = listingPublicSegment(listingId, customSlug)
  return `${shopStorefrontPath(storeSlug)}/product/${encodeURIComponent(segment)}`
}

export { isAffiliateShopStorefrontPath } from "@/lib/mobile-chrome"

/** Legacy `/marketplace` index — role-based redirect target. */
export function resolveLegacyMarketplaceIndexPath(role: string | undefined): string {
  if (role === "AFFILIATE") return AFFILIATE_CATALOG_PATH
  if (role === "SUPPLIER") return "/dashboard/supplier"
  return PUBLIC_MARKETPLACE_BROWSE_PATH
}

export function isMarketplaceListingPath(pathname: string): boolean {
  if (!pathname.startsWith("/marketplace/")) return false
  if (pathname.startsWith("/marketplace/account")) return false
  const rest = pathname.slice("/marketplace/".length)
  return rest.length > 0 && !rest.includes("/")
}
