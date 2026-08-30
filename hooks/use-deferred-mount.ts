"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import { useInView } from "framer-motion"

import { scheduleIdleTask } from "@/lib/schedule-idle-task"

type Options = {
  /** requestIdleCallback timeout — long idle before fallback mount. */
  idleTimeoutMs?: number
  /** setTimeout fallback when requestIdleCallback is unavailable. */
  fallbackDelayMs?: number
  /** IntersectionObserver root margin (framer-motion `margin`). */
  rootMargin?: string
}

/**
 * Defer heavy client trees until the anchor enters the viewport OR idle elapses.
 * Uses startTransition when flipping ready — keeps home TBT low (no “Page ne répond pas”).
 */
export function useDeferredMount(options: Options = {}) {
  const {
    idleTimeoutMs = 5200,
    fallbackDelayMs = 2800,
    rootMargin = "160px 0px",
  } = options

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: rootMargin })
  const [idleReady, setIdleReady] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return scheduleIdleTask(() => setIdleReady(true), idleTimeoutMs, fallbackDelayMs)
  }, [idleTimeoutMs, fallbackDelayMs])

  useEffect(() => {
    if (!ready && (inView || idleReady)) {
      startTransition(() => setReady(true))
    }
  }, [inView, idleReady, ready])

  return { ref, ready, inView, idleReady }
}
