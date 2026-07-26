"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
  /** Accessible name for the scroll region. */
  ariaLabel?: string
  /** Tighter gap for dense chip rows. */
  density?: "default" | "compact"
}

/**
 * Single-line horizontal rail with edge fades — mobile-first trust / legal strips.
 * Keeps chips on one line without wrapping or crushing typography.
 */
export function FooterScrollRail({
  children,
  className,
  ariaLabel,
  density = "default",
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  const syncFades = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 2) {
      setFade({ left: false, right: false })
      return
    }
    setFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < max - 4,
    })
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
      className={cn(
        "affisell-footer-scroll-rail relative",
        fade.left && "affisell-footer-scroll-rail--fade-l",
        fade.right && "affisell-footer-scroll-rail--fade-r",
        className
      )}
    >
      <div
        ref={scrollerRef}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "affisell-footer-scroll-rail__track flex flex-nowrap items-center overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          density === "compact" ? "gap-1.5" : "gap-2.5",
          "snap-x snap-mandatory scroll-px-1"
        )}
      >
        {children}
      </div>
    </div>
  )
}
