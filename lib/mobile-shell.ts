/** Bottom inset when the floating buyer dock is visible (mobile). */
export const AFFISELL_MOBILE_DOCK_OFFSET = "calc(4.75rem + env(safe-area-inset-bottom))"

/** Sticky CTAs on pages that keep the dock visible. */
export const AFFISELL_MOBILE_STICKY_ABOVE_DOCK =
  "calc(5.25rem + env(safe-area-inset-bottom))"

export function shouldHideMobileDock(pathname: string): boolean {
  if (!pathname) return false
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding")
  ) {
    return true
  }
  if (pathname.startsWith("/dashboard")) return true
  if (pathname.startsWith("/discover")) return true
  if (/^\/marketplace\/[^/]+$/.test(pathname)) return true
  if (/^\/shops\/[^/]+\/product\//.test(pathname)) return true
  return false
}
