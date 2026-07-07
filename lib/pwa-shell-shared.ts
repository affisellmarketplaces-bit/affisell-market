/** Shared PWA shell constants — keep in sync with `public/sw.js`. */
export const PWA_SHELL_CACHE_VERSION = "affisell-buyer-v1"

export const PWA_SHELL_CACHE = `${PWA_SHELL_CACHE_VERSION}-shell`

export const PWA_CATALOG_CACHE = `${PWA_SHELL_CACHE_VERSION}-catalog`

export const PWA_PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/placeholder-product.jpg",
] as const

export const PWA_CATALOG_API_PATH = "/api/marketplace/products"

export const PWA_OFFLINE_NAV_PREFIXES = ["/", "/marketplace", "/cart", "/wishlist"] as const

export const PWA_SW_PATH = "/sw.js"
