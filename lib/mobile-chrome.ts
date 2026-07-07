/** Routes with full-screen buyer UX — suppress duplicate mobile chrome (cookies, global toasts). */

const LOCALE_PREFIX = /^\/(en|fr)(?=\/|$)/

/** Bottom inset when the floating buyer dock is visible (mobile). Mirrors `--affisell-mobile-dock-offset`. */
export const AFFISELL_MOBILE_DOCK_OFFSET =
  "var(--affisell-mobile-dock-offset, calc(4.2rem + env(safe-area-inset-bottom, 0px)))"

/** Sticky CTAs on pages that keep the dock visible. Mirrors `--affisell-mobile-sticky-above-dock`. */
export const AFFISELL_MOBILE_STICKY_ABOVE_DOCK =
  "calc(var(--affisell-mobile-sticky-above-dock, 4.65rem) + env(safe-area-inset-bottom, 0px))"

/** Sticky catalog chrome below compact header. Mirrors `--affisell-site-header-offset-sticky`. */
export const AFFISELL_SITE_HEADER_OFFSET_STICKY =
  "var(--affisell-site-header-offset-sticky, calc(2.85rem + env(safe-area-inset-top, 0px)))"

export function barePathname(pathname: string): string {
  const p = pathname.trim() || "/"
  return p.replace(LOCALE_PREFIX, "") || "/"
}

export function isImmersiveBuyerRoute(pathname: string): boolean {
  const bare = barePathname(pathname)
  if (bare.startsWith("/discover")) return true
  if (bare.startsWith("/luxe")) return true
  if (bare.startsWith("/auctions")) return true
  if (/^\/marketplace\/[^/]+$/.test(bare)) return true
  if (/^\/shops\/[^/]+\/product\//.test(bare)) return true
  return false
}

/** Individual affiliate storefront (`/shops/:slug`), not directory or cross-store browse. */
export function isAffiliateShopStorefrontPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const bare = barePathname(pathname.split("?")[0] ?? "")
  if (!bare.startsWith("/shops/")) return false
  if (bare === "/shops/browse" || bare.startsWith("/shops/browse/")) return false
  return true
}

export function isCheckoutFocusRoute(pathname: string): boolean {
  const bare = barePathname(pathname)
  return (
    bare === "/checkout" ||
    bare.startsWith("/checkout/") ||
    bare === "/success" ||
    bare.startsWith("/success/")
  )
}

export function shouldHideMobileDock(pathname: string): boolean {
  if (!pathname) return false
  const bare = barePathname(pathname)
  if (
    bare.startsWith("/login") ||
    bare.startsWith("/signup") ||
    bare.startsWith("/onboarding")
  ) {
    return true
  }
  if (bare.startsWith("/dashboard")) return true
  if (bare.startsWith("/demo")) return true
  if (isAffiliateShopStorefrontPath(pathname)) return true
  if (isImmersiveBuyerRoute(pathname)) return true
  if (isCheckoutFocusRoute(pathname)) return true
  return false
}
