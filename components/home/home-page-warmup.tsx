"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { HOME_WARM_ROUTES } from "@/lib/nav-routes"
import { scheduleIdleTask } from "@/lib/schedule-idle-task"
import { prefetchRoutes } from "@/lib/prefetch-routes"

/** Prefetch hero + catalog routes after idle so first clicks feel instant. */
export function HomePageWarmup() {
  const router = useRouter()

  useEffect(() => {
    const cancelRoutes = scheduleIdleTask(
      () => prefetchRoutes((href) => router.prefetch(href), HOME_WARM_ROUTES),
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
  }, [router])

  return null
}
