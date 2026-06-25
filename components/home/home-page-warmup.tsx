"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { HOME_WARM_ROUTES } from "@/lib/nav-routes"
import { schedulePrefetchRoutes } from "@/lib/prefetch-routes"

/** Prefetch hero + catalog routes after hydration so first clicks feel instant. */
export function HomePageWarmup() {
  const router = useRouter()

  useEffect(
    () => schedulePrefetchRoutes((href) => router.prefetch(href), HOME_WARM_ROUTES),
    [router]
  )

  return null
}
