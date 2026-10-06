"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import {
  nextHeaderMode,
  rebaseHeaderMode,
  type HeaderMode,
  type HeaderModeState,
} from "@/lib/storefront/header-mode"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
/** A scroll that lands this soon after a viewport size change is the browser re-anchoring the page, not the visitor. */
const VIEWPORT_SETTLE_MS = 250

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/**
 * `true` unless the visitor asked for reduced motion; `false` on the server and during hydration, so the server HTML and
 * the first client render always agree. A header that slides in and out on every scroll is exactly what that setting
 * exists to prevent — those visitors keep the ordinary, static header.
 */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => !window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )
}

/** The header mode for the current scroll position while `active` (window scroll, rAF-throttled, passive). */
export function useHeaderMode(active: boolean): HeaderMode {
  const [mode, setMode] = useState<HeaderMode>("full")
  const stateRef = useRef<HeaderModeState>({ mode: "full", lastY: 0 })

  useEffect(() => {
    stateRef.current = { mode: "full", lastY: active ? window.scrollY : 0 }
    setMode("full")
    if (!active) return

    let raf = 0
    let viewport = { w: window.innerWidth, h: window.innerHeight }
    let viewportChangedAt = Number.NEGATIVE_INFINITY

    // Mobile browsers resize the viewport while scrolling (iOS toolbar collapse) and on rotation, and shift scrollY with it.
    const onResize = () => {
      if (window.innerWidth === viewport.w && window.innerHeight === viewport.h) return
      viewport = { w: window.innerWidth, h: window.innerHeight }
      viewportChangedAt = performance.now()
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (performance.now() - viewportChangedAt < VIEWPORT_SETTLE_MS) {
          stateRef.current = rebaseHeaderMode(stateRef.current, y)
          return
        }
        const maxY = document.documentElement.scrollHeight - window.innerHeight
        const next = nextHeaderMode(stateRef.current, y, { maxY })
        stateRef.current = next
        setMode((current) => (current === next.mode ? current : next.mode))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active])

  return mode
}
