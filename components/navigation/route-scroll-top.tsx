"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { shouldResetBuyerScroll } from "@/lib/buyer-scroll-reset-paths"
import type { InstantNavStartDetail } from "@/lib/instant-navigation-events.client"
import { INSTANT_NAV_START } from "@/lib/instant-navigation-events.client"
import { normalizePrefetchHref } from "@/lib/prefetch-href.client"

function resetWindowScroll(): void {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

/**
 * Resets scroll on buyer catalog → PDP hops so users never land mid-footer.
 * Also scrolls early on pointer-down when the destination is a reset route.
 */
export function RouteScrollTop() {
  const pathname = usePathname() ?? ""
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (!shouldResetBuyerScroll(pathname)) return
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    resetWindowScroll()
    const raf = window.requestAnimationFrame(resetWindowScroll)
    return () => window.cancelAnimationFrame(raf)
  }, [pathname])

  useEffect(() => {
    const onInstantStart = (event: Event) => {
      const href = (event as CustomEvent<InstantNavStartDetail>).detail?.href
      if (!href) return
      const path = normalizePrefetchHref(href)
      if (path && shouldResetBuyerScroll(path)) {
        resetWindowScroll()
      }
    }

    window.addEventListener(INSTANT_NAV_START, onInstantStart)
    return () => window.removeEventListener(INSTANT_NAV_START, onInstantStart)
  }, [])

  return null
}
