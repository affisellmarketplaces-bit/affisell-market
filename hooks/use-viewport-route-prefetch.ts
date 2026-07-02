"use client"

import { startTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { normalizePrefetchHref } from "@/lib/prefetch-href.client"

type Options = {
  selector?: string
  max?: number
  enabled?: boolean
  /** Re-scan when catalog pages grow (SWR infinite scroll). */
  deps?: readonly unknown[]
}

/**
 * Prefetch same-origin links as they enter the viewport (catalog grids, rails).
 */
export function useViewportRoutePrefetch<T extends HTMLElement>({
  selector = 'a[href^="/"]',
  max = 16,
  enabled = true,
  deps = [],
}: Options = {}) {
  const ref = useRef<T | null>(null)
  const router = useRouter()
  const prefetched = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled) return
    const root = ref.current
    if (!root) return

    const warmVisible = (anchor: Element) => {
      if (!(anchor instanceof HTMLAnchorElement)) return
      const path = normalizePrefetchHref(anchor.getAttribute("href"))
      if (!path || prefetched.current.has(path)) return
      if (prefetched.current.size >= max) return
      prefetched.current.add(path)
      startTransition(() => {
        try {
          router.prefetch(path)
        } catch {
          /* ignore */
        }
      })
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) warmVisible(entry.target)
        }
      },
      { rootMargin: "160px 0px", threshold: 0.01 }
    )

    const observeAll = () => {
      root.querySelectorAll(selector).forEach((link) => io.observe(link))
    }

    observeAll()

    const mo = new MutationObserver(() => {
      observeAll()
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is an intentional external trigger
  }, [enabled, max, router, selector, ...deps])

  return ref
}
