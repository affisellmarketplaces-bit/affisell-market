import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { resolvePublicNavActive } from "@/lib/public-nav-active"

export type PublicNavSearchContext = "home" | "marketplace" | "creatorStores"

export function resolvePublicNavSearchContext(
  pathname: string,
  explorerHash: boolean
): PublicNavSearchContext {
  const { onMarketplace, onShops } = resolvePublicNavActive(pathname, explorerHash)
  if (onMarketplace) return "marketplace"
  if (onShops) return "creatorStores"
  return "home"
}

export const PUBLIC_NAV_SEARCH_QUICK_LINKS = [
  { id: "browse", href: PUBLIC_MARKETPLACE_BROWSE_PATH, labelKey: "searchQuickBrowse" as const },
  { id: "shops", href: "/shops", labelKey: "searchQuickStores" as const },
  { id: "discover", href: "/discover", labelKey: "searchQuickDiscover" as const },
  { id: "auctions", href: "/auctions", labelKey: "searchQuickAuctions" as const },
] as const
