/** Affiliate product discovery (margins, commissions) — not the public buyer marketplace. */
import { listingPublicSegment } from "@/lib/listing-public-url-shared"
export const AFFILIATE_CATALOG_PATH = "/dashboard/affiliate/catalog"

/**
 * Affiliate hub shell — modes are exclusive (never mix Battle + Swipe UI):
 * - `?mode=swipe` → Swipe Feed (discover SKUs → list in vitrine)
 * - `?mode=battle` → Pulse Battle (pick 2 listed products → duel / flash)
 * - no mode → launcher choosing Battle vs Swipe
 */
export const AFFILIATE_HUB_PATH = "/dashboard/affiliate/hub"
export const AFFILIATE_HUB_SWIPE_HREF = `${AFFILIATE_HUB_PATH}?mode=swipe` as const
export const AFFILIATE_HUB_BATTLE_HREF = `${AFFILIATE_HUB_PATH}?mode=battle` as const

export type AffiliateHubMode = "hub" | "swipe" | "battle"

export function parseAffiliateHubMode(raw: string | undefined | null): AffiliateHubMode {
  if (raw === "swipe") return "swipe"
  if (raw === "battle") return "battle"
  return "hub"
}

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
