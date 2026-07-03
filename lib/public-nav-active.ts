import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export type PublicNavActiveState = {
  onHome: boolean
  onMarketplace: boolean
  onShops: boolean
}

/** Pure active-state logic for buyer public header pills. */
export function resolvePublicNavActive(
  pathname: string,
  explorerHash: boolean
): PublicNavActiveState {
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

  return { onHome, onMarketplace, onShops }
}
