"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Soft-nav to `/browse/*` often keeps the previous page scrollY (`scroll={false}` on
 * marketplace rails). Reset to top so category products appear above the fold —
 * never land mid-footer.
 */
export function BrowseScrollTop() {
  const pathname = usePathname() ?? ""
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname.startsWith("/browse/")) return
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    reset()
    // One frame later — catches late layout / sticky header measurements.
    const raf = window.requestAnimationFrame(reset)
    return () => window.cancelAnimationFrame(raf)
  }, [pathname])

  return null
}
