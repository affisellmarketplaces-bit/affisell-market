"use client"

import { startTransition, useEffect } from "react"

import { signalInstantNavigationStart } from "@/lib/instant-navigation-events.client"
import {
  isSameOriginNavigableAnchor,
  normalizePrefetchHref,
} from "@/lib/prefetch-href.client"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

const prefetchedOnPress = new Set<string>()

/**
 * Pointerdown prefetch + instant progress bar — perceived latency drops before route commit.
 */
export function InstantNavigationListener() {
  const { prefetch, mounted } = useSafeAppRouter()

  useEffect(() => {
    if (!mounted) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest("a")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (!isSameOriginNavigableAnchor(anchor)) return

      const path = normalizePrefetchHref(anchor.getAttribute("href"))
      if (!path) return

      signalInstantNavigationStart()

      if (prefetchedOnPress.has(path)) return
      prefetchedOnPress.add(path)
      startTransition(() => {
        try {
          prefetch(path)
        } catch {
          /* ignore */
        }
      })
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true })
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true })
  }, [mounted, prefetch])

  return null
}
