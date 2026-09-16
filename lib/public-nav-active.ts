import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export type PublicNavActiveState = {
  onHome: boolean
  onMarketplace: boolean
  onShops: boolean
  onDiscover: boolean
  onBattles: boolean
}

/**
 * Pure active-state logic for buyer public header pills.
 * `#explorer` on `/` must NOT flip chrome to marketplace —
 * home stays `onHome` while sharing the same PublicNav browse chrome.
 */
export function resolvePublicNavActive(
  pathname: string,
  explorerHash: boolean
): PublicNavActiveState {
  const bare = pathname.split("?")[0] ?? pathname
  // explorerHash kept for API stability / future in-page accents; chrome stays home.
  void explorerHash
  const onHome = pathname === "/"
  const onMarketplaceBrowse =
    pathname === PUBLIC_MARKETPLACE_BROWSE_PATH ||
    pathname === "/marketplace" ||
    pathname.startsWith("/marketplace/")
  const onMarketplace = onMarketplaceBrowse
  const onShops =
    pathname === "/shops" ||
    (pathname.startsWith("/shops/") && !pathname.startsWith(PUBLIC_MARKETPLACE_BROWSE_PATH))
  const onBattles = bare.startsWith("/battles")
  const onDiscover =
    !onBattles && (bare.startsWith("/discover") || bare.startsWith("/pulse"))

  return { onHome, onMarketplace, onShops, onDiscover, onBattles }
}
