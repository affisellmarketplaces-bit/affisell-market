import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export type PublicNavMode = "browse" | "transaction" | "account"

const TRANSACTION_PREFIXES = ["/cart", "/checkout", "/success"] as const

const ACCOUNT_PREFIXES = [
  "/marketplace/account",
  "/track-order",
  "/wishlist",
] as const

/** Adaptive buyer header mode — browse (discover), transaction (cart/checkout), account. */
export function resolvePublicNavMode(pathname: string): PublicNavMode {
  const path = pathname.split("?")[0] ?? pathname
  if (TRANSACTION_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return "transaction"
  }
  if (ACCOUNT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return "account"
  }
  return "browse"
}

export function resolvePublicNavBackHref(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname
  if (path === "/success" || path.startsWith("/success/")) {
    return "/marketplace/account/orders"
  }
  return PUBLIC_MARKETPLACE_BROWSE_PATH
}

function isPublicAuthRoute(pathname: string): boolean {
  if (pathname.startsWith("/auth/")) return true
  if (pathname === "/login" || pathname.startsWith("/login/")) return true
  if (pathname.startsWith("/signup")) return true
  if (pathname.startsWith("/onboarding/")) return true
  return false
}

function isCreatorStorefrontPath(pathname: string): boolean {
  return pathname.startsWith("/shops/") && !pathname.startsWith("/shops/browse")
}

/** Buyer trust strip — public browse pages only (not auth, storefront, or dashboard). */
export function shouldShowPublicTrustStrip(pathname: string | null): boolean {
  if (!pathname) return false
  const path = pathname.split("?")[0] ?? pathname
  if (isPublicAuthRoute(path)) return false
  if (isCreatorStorefrontPath(path)) return false
  if (path.startsWith("/dashboard")) return false
  return resolvePublicNavMode(path) === "browse"
}

export const PUBLIC_NAV_ACCOUNT_LINKS = [
  { id: "orders", href: "/marketplace/account/orders", labelKey: "accountOrders" as const, exact: false },
  { id: "wishlist", href: "/wishlist", labelKey: "accountWishlist" as const, exact: false },
  { id: "hub", href: "/marketplace/account", labelKey: "accountHub" as const, exact: true },
  { id: "track", href: "/track-order", labelKey: "accountTrack" as const, exact: false },
] as const
