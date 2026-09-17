"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
  /** Accessible name for the scroll region. */
  ariaLabel?: string
}

/**
 * Single-line horizontal chip/pill row with edge fades — signals more
 * content off-screen instead of an abrupt crop at the viewport edge.
 * Fades track real scroll position (none once a rail is fully scrolled).
 */
export function ScrollFadeRow({ children, className, ariaLabel }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  const syncFades = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 2) {
      el.style.setProperty("--affisell-scroll-fade-l", "0px")
      el.style.setProperty("--affisell-scroll-fade-r", "0px")
      return
    }
    el.style.setProperty("--affisell-scroll-fade-l", el.scrollLeft > 4 ? "1.5rem" : "0px")
    el.style.setProperty("--affisell-scroll-fade-r", el.scrollLeft < max - 4 ? "1.5rem" : "0px")
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    syncFades()
    el.addEventListener("scroll", syncFades, { passive: true })
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncFades) : null
    ro?.observe(el)
    window.addEventListener("resize", syncFades, { passive: true })
    return () => {
      el.removeEventListener("scroll", syncFades)
      ro?.disconnect()
      window.removeEventListener("resize", syncFades)
    }
  }, [syncFades, children])

  return (
    <div
      ref={scrollerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "affisell-scroll-fade-row flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </div>
  )
}
