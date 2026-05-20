import {
  AFFILIATE_AGENT_PATH,
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  PUBLIC_SHOPS_PATH,
} from "@/lib/affiliate-routes"

/** Routes préchargées au survol / au chargement pour une navigation instantanée. */
export const BUYER_WARM_ROUTES = [
  "/",
  PUBLIC_SHOPS_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  "/login",
  "/cart",
  "/wishlist",
] as const

export const AFFILIATE_WARM_ROUTES = [
  "/dashboard/affiliate",
  AFFILIATE_CATALOG_PATH,
  AFFILIATE_AGENT_PATH,
  "/dashboard/affiliate/earnings",
] as const

export const SUPPLIER_WARM_ROUTES = [
  "/dashboard/supplier",
  "/dashboard/supplier/products",
  "/dashboard/supplier/orders",
] as const

/** Quick navigation catalog lives in `@/lib/command-k-catalog`. */
