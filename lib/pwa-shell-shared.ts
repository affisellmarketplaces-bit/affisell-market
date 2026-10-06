/** Shared PWA shell constants — keep in sync with `public/sw.js`. */
export const PWA_SHELL_CACHE_VERSION = "affisell-buyer-v2"

export const PWA_SHELL_CACHE = `${PWA_SHELL_CACHE_VERSION}-shell`

export const PWA_CATALOG_CACHE = `${PWA_SHELL_CACHE_VERSION}-catalog`

export const PWA_PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/placeholder-product.jpg",
] as const

export const PWA_CATALOG_API_PATH = "/api/marketplace/products"

/** Navigations that get an offline fallback (network-first): the buyer shell. */
export const PWA_OFFLINE_NAV_PREFIXES = ["/", "/marketplace", "/cart", "/wishlist"] as const

/**
 * The ONLY pages whose HTML the service worker may store, and only as an ANONYMOUS copy (fetched without cookies).
 * Every page embeds the signed-in user's session (app/layout.tsx → AuthSessionProvider), so a copy of the visitor's own
 * navigation would leave their identity in Cache Storage, readable offline after they sign out on a shared device.
 * Fail-closed: a page that is not listed here is never stored.
 */
export const PWA_PUBLIC_SHELL_PATHS = ["/", "/marketplace/bestsellers"] as const

export const PWA_SW_PATH = "/sw.js"
