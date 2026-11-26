"use client"

import { startTransition, useEffect, useRef, useState, type RefObject } from "react"

import { scheduleIdleTask } from "@/lib/schedule-idle-task"

type Options = {
  /** requestIdleCallback timeout — long idle before fallback mount. */
  idleTimeoutMs?: number
  /** setTimeout fallback when requestIdleCallback is unavailable. */
  fallbackDelayMs?: number
  /** IntersectionObserver root margin, CSS syntax ("160px 0px"). */
  rootMargin?: string
}

/**
 * True once the element has entered the viewport (grown by `rootMargin`), then never false again.
 * Native IntersectionObserver: this hook runs on the home page's first JavaScript, where the
 * framer-motion `useInView` it replaces cost ~44 KB gzip for one observer. Without
 * IntersectionObserver (very old browsers) the element counts as visible, so content still mounts.
 */
export function useInViewOnce(ref: RefObject<Element | null>, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin, inView])
  return inView
}

/**
 * Defer heavy client trees until the anchor is in view **and** idle budget elapsed.
 * Prevents `/#explorer` from synchronously loading MarketplaceView on first paint (Safari freeze).
 */
export function useIdleInViewMount(options: Options = {}) {
  const {
    idleTimeoutMs = 5200,
    fallbackDelayMs = 2800,
    rootMargin = "160px 0px",
  } = options

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInViewOnce(ref, rootMargin)
  const [idleReady, setIdleReady] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return scheduleIdleTask(() => setIdleReady(true), idleTimeoutMs, fallbackDelayMs)
  }, [idleTimeoutMs, fallbackDelayMs])

  useEffect(() => {
    if (!ready && idleReady && inView) {
      startTransition(() => setReady(true))
    }
  }, [inView, idleReady, ready])

  return { ref, ready, inView, idleReady }
}
