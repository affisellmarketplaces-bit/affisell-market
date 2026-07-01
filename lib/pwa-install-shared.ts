export const PWA_INSTALL_DISMISS_KEY = "affisell_pwa_install_dismissed_v1"

/** Routes where the install banner may appear (buyer mobile journeys). */
export const PWA_INSTALL_PATH_PREFIXES = ["/discover", "/marketplace", "/cart", "/wishlist"] as const

export function isPwaInstallEligiblePath(pathname: string): boolean {
  return PWA_INSTALL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
