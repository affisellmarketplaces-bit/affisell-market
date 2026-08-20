import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"

/** Buyer routes that skip async proxy work (JWT, custom domain fetch, intl). */
export function isBuyerPublicFastPath(barePath: string): boolean {
  if (barePath === PUBLIC_SHOPS_PATH || barePath.startsWith(`${PUBLIC_SHOPS_PATH}/`)) {
    return true
  }
  if (barePath === PUBLIC_MARKETPLACE_BROWSE_PATH) return true
  if (barePath === "/marketplace" || barePath.startsWith("/marketplace/")) {
    return !barePath.startsWith("/marketplace/account")
  }
  if (barePath === "/discover" || barePath.startsWith("/discover/")) return true
  if (barePath === "/cart" || barePath.startsWith("/cart/")) return true
  if (barePath === "/wishlist" || barePath.startsWith("/wishlist/")) return true
  if (barePath === "/agent" || barePath.startsWith("/agent/")) return true
  if (barePath === "/battles" || barePath.startsWith("/battles/")) return true
  if (barePath === "/auctions" || barePath.startsWith("/auctions/")) return true
  return false
}
