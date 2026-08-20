export const RESILIENT_NAV_STALL_MS =
  process.env.NODE_ENV === "development" ? 8000 : 12000

/** True when soft navigation stalled and a hard assign is warranted. */
export function shouldHardFallbackNav(targetPath: string, currentPathname: string): boolean {
  if (currentPathname === targetPath) return false
  if (currentPathname.startsWith(`${targetPath}/`)) return false
  return true
}

let navLock = false

export function tryAcquireResilientNavLock(): boolean {
  if (navLock) return false
  navLock = true
  return true
}

export function releaseResilientNavLock(): void {
  navLock = false
}

export function hrefPathFromString(href: string): string {
  const base = href.split("?")[0]?.split("#")[0] ?? "/"
  return base || "/"
}

export function isInPageHashLink(href: string): boolean {
  return href.startsWith("/#") || (href.includes("#") && !href.startsWith("http"))
}
