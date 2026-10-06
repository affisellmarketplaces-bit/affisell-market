"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { nextHeaderMode, type HeaderMode, type HeaderModeState } from "@/lib/storefront/header-mode"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

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
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const next = nextHeaderMode(stateRef.current, window.scrollY)
        stateRef.current = next
        setMode((current) => (current === next.mode ? current : next.mode))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active])

  return mode
}
