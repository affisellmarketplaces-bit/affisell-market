export const RESILIENT_NAV_STALL_MS =
  process.env.NODE_ENV === "development" ? 4000 : 12000

/** True when soft navigation stalled and a hard assign is warranted. */
export function shouldHardFallbackNav(targetPath: string, currentPathname: string): boolean {
  if (currentPathname === targetPath) return false
  if (currentPathname.startsWith(`${targetPath}/`)) return false
  return true
}

let navLock = false
let navLockHref: string | null = null

export type ResilientNavLockResult = "acquired" | "repeat-hard-fallback"

/**
 * Dedupe rapid double-taps; repeat click on same href while locked → hard fallback.
 * Different href while locked steals the lock (user changed intent).
 */
export function tryAcquireResilientNavLock(href: string): ResilientNavLockResult {
  if (!navLock) {
    navLock = true
    navLockHref = href
    return "acquired"
  }
  if (navLockHref === href) return "repeat-hard-fallback"
  navLockHref = href
  return "acquired"
}

export function releaseResilientNavLock(): void {
  navLock = false
  navLockHref = null
}

export function hrefPathFromString(href: string): string {
  const base = href.split("?")[0]?.split("#")[0] ?? "/"
  return base || "/"
}

export function isInPageHashLink(href: string): boolean {
  return href.startsWith("/#") || (href.includes("#") && !href.startsWith("http"))
}
