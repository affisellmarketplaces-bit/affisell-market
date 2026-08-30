export const INSTANT_NAV_START = "affisell:instant-nav-start" as const

export type InstantNavStartDetail = {
  href: string
}

export function signalInstantNavigationStart(href: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<InstantNavStartDetail>(INSTANT_NAV_START, { detail: { href } })
  )
}
