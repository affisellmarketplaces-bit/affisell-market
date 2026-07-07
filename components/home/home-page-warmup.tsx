"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { HOME_WARM_ROUTES } from "@/lib/nav-routes"
import { schedulePrefetchRoutes } from "@/lib/prefetch-routes"

const HOME_CATALOG_LITE_API = "/api/marketplace/products?lite=1"

function scheduleIdleTask(run: () => void, idleTimeoutMs = 1800, fallbackDelayMs = 450): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const t = window.setTimeout(run, fallbackDelayMs)
  return () => window.clearTimeout(t)
}

/** Prefetch hero routes + lite catalog API after hydration for instant first paint on scroll. */
export function HomePageWarmup() {
  const router = useRouter()

  useEffect(() => {
    const cancelRoutes = schedulePrefetchRoutes((href) => router.prefetch(href), HOME_WARM_ROUTES)
    const cancelCatalog = scheduleIdleTask(() => {
      void fetch(HOME_CATALOG_LITE_API, { priority: "low" }).catch(() => {
        /* warm cache only */
      })
    })

    return () => {
      cancelRoutes()
      cancelCatalog()
    }
  }, [router])

  return null
}
