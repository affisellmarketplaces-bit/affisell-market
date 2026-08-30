"use client"

import { useEffect } from "react"

import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"
import { scheduleIdleTask } from "@/lib/schedule-idle-task"
import { prefetchRoutes } from "@/lib/prefetch-routes"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

/** Critical buyer routes only — avoid prefetch storms that block the main thread on `/`. */
const HOME_CRITICAL_ROUTES = ["/agent", PUBLIC_SHOPS_PATH, BUYER_BESTSELLERS_PATH] as const

/** Prefetch hero shortcuts after long idle — first clicks still feel instant. */
export function HomePageWarmup() {
  const { prefetch, mounted } = useSafeAppRouter()

  useEffect(() => {
    if (!mounted) return

    return scheduleIdleTask(
      () => prefetchRoutes((href) => prefetch(href), HOME_CRITICAL_ROUTES),
      6500,
      3200
    )
  }, [mounted, prefetch])

  return null
}
