import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export type PublicNavActiveState = {
  onHome: boolean
  onMarketplace: boolean
  onShops: boolean
  onDiscover: boolean
  onBattles: boolean
}

/** Pure active-state logic for buyer public header pills. */
export function resolvePublicNavActive(
  pathname: string,
  explorerHash: boolean
): PublicNavActiveState {
  const bare = pathname.split("?")[0] ?? pathname
  const onExplorerSection = pathname === "/" && explorerHash
  const onHome = pathname === "/" && !onExplorerSection
  const onMarketplaceBrowse =
    pathname === PUBLIC_MARKETPLACE_BROWSE_PATH ||
    pathname === "/marketplace" ||
    pathname.startsWith("/marketplace/")
  const onMarketplace = onMarketplaceBrowse || onExplorerSection
  const onShops =
    pathname === "/shops" ||
    (pathname.startsWith("/shops/") && !pathname.startsWith(PUBLIC_MARKETPLACE_BROWSE_PATH))
  const onBattles = bare.startsWith("/battles")
  const onDiscover =
    !onBattles && (bare.startsWith("/discover") || bare.startsWith("/pulse"))

  return { onHome, onMarketplace, onShops, onDiscover, onBattles }
}
