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

export const PUBLIC_NAV_ACCOUNT_LINKS = [
  { id: "orders", href: "/marketplace/account/orders", labelKey: "accountOrders" as const, exact: false },
  { id: "wishlist", href: "/wishlist", labelKey: "accountWishlist" as const, exact: false },
  { id: "hub", href: "/marketplace/account", labelKey: "accountHub" as const, exact: true },
  { id: "track", href: "/track-order", labelKey: "accountTrack" as const, exact: false },
] as const
