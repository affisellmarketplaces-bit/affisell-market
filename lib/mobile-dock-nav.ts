/** True when soft navigation stalled and a hard assign is warranted. */
export function shouldHardFallbackNav(targetPath: string, currentPathname: string): boolean {
  if (currentPathname === targetPath) return false
  if (currentPathname.startsWith(`${targetPath}/`)) return false
  return true
}

export const MOBILE_DOCK_NAV_STALL_MS =
  process.env.NODE_ENV === "development" ? 4000 : 10000
