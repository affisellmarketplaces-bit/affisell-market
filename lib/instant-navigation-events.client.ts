export const INSTANT_NAV_START = "affisell:instant-nav-start" as const

export function signalInstantNavigationStart(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(INSTANT_NAV_START))
}
