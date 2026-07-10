"use client"

import { useEffect } from "react"

import { HOME_WARM_ROUTES } from "@/lib/nav-routes"
import { scheduleIdleTask } from "@/lib/schedule-idle-task"
import { prefetchRoutes } from "@/lib/prefetch-routes"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

/** Prefetch hero + catalog routes after idle so first clicks feel instant. */
export function HomePageWarmup() {
  const { prefetch, mounted } = useSafeAppRouter()

  useEffect(() => {
    if (!mounted) return
    const cancelRoutes = scheduleIdleTask(
      () => prefetchRoutes((href) => prefetch(href), HOME_WARM_ROUTES),
      2600,
      700
    )
    const cancelCatalog = scheduleIdleTask(() => {
      void fetch("/api/marketplace/products?lite=1", { priority: "low" }).catch(() => {
        /* warm cache only */
      })
    }, 3000, 900)

    return () => {
      cancelRoutes()
      cancelCatalog()
    }
  }, [mounted, prefetch])

  return null
}
