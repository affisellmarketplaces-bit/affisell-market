import {
  AFFILIATE_AGENT_PATH,
  AFFILIATE_CATALOG_PATH,
  PUBLIC_SHOPS_PATH,
} from "@/lib/affiliate-routes"

/** Routes préchargées au survol / au chargement pour une navigation instantanée. */
export const BUYER_WARM_ROUTES = [
  "/",
  PUBLIC_SHOPS_PATH,
  "/marketplace/account",
  "/agent",
  "/creators",
  "/returns",
  "/protected-checkout",
  "/login",
  "/auctions",
  "/battles",
  "/luxe",
] as const

/** Mobile buyer — lighter prefetch (bandwidth + CPU during LCP). */
export const BUYER_MOBILE_WARM_ROUTES = ["/", "/cart", "/marketplace/account", "/login"] as const

/** Hero + tuiles buyer sur `/` — prefetch immédiat au mount. */
export const HOME_WARM_ROUTES = BUYER_WARM_ROUTES

export const AFFILIATE_WARM_ROUTES = [
  "/dashboard/affiliate",
  AFFILIATE_CATALOG_PATH,
  AFFILIATE_AGENT_PATH,
  "/dashboard/affiliate/earnings",
  "/dashboard/affiliate/promote",
  "/lab",
  "/discover",
] as const

export const SUPPLIER_WARM_ROUTES = [
  "/dashboard/supplier",
  "/dashboard/supplier/products",
  "/dashboard/supplier/orders",
  "/dashboard/supplier/bookings",
  "/dashboard/supplier/promote",
  "/dropforge",
  "/lab",
] as const

/** Quick navigation catalog lives in `@/lib/command-k-catalog`. */
