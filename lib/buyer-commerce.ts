/**
 * Buyer-only commerce (cart, orders, wallet) is surfaced on the public marketplace,
 * not in affiliate/supplier dashboards.
 */

export function isMerchantRole(role: string | null | undefined): boolean {
  return role === "AFFILIATE" || role === "SUPPLIER"
}

/** URLs where logged-out or CUSTOMER users may see cart / orders / wallet entry points in the global header. */
export function isBuyerCommerceSurfacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === "/") return true
  if (pathname === "/cart") return true
  if (pathname.startsWith("/marketplace")) return true
  if (pathname === "/wishlist") return true
  return false
}

export function showBuyerCommerceInSiteHeader(
  pathname: string | null | undefined,
  role: string | null | undefined,
  hasSession: boolean
): boolean {
  if (!isBuyerCommerceSurfacePath(pathname)) return false
  if (!hasSession) return true
  return !isMerchantRole(role)
}
