"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { HOME_WARM_ROUTES } from "@/lib/nav-routes"
import { prefetchRoutes } from "@/lib/prefetch-routes"

/** Aggressive prefetch on `/` so hero tiles + catalog clicks feel instant. */
export function HomePageWarmup() {
  const router = useRouter()

  useEffect(() => {
    const warm = () => prefetchRoutes((href) => router.prefetch(href), HOME_WARM_ROUTES)
    warm()
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 800 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(warm, 120)
    return () => window.clearTimeout(t)
  }, [router])

  return null
}
