"use client"

import { startTransition, useEffect } from "react"
import { useRouter } from "next/navigation"

import { signalInstantNavigationStart } from "@/lib/instant-navigation-events.client"
import {
  isSameOriginNavigableAnchor,
  normalizePrefetchHref,
} from "@/lib/prefetch-href.client"

const prefetchedOnPress = new Set<string>()

/**
 * Pointerdown prefetch + instant progress bar — perceived latency drops before route commit.
 */
export function InstantNavigationListener() {
  const router = useRouter()

  useEffect(() => {
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
          router.prefetch(path)
        } catch {
          /* ignore */
        }
      })
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true })
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true })
  }, [router])

  return null
}
