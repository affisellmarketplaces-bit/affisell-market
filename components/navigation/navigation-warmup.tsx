"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

import {
  AFFILIATE_WARM_ROUTES,
  BUYER_WARM_ROUTES,
  SUPPLIER_WARM_ROUTES,
} from "@/lib/nav-routes"
import { schedulePrefetchRoutes } from "@/lib/prefetch-routes"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

/** Prefetch key routes once per session so first clicks feel instant. */
export function NavigationWarmup() {
  const { prefetch, mounted } = useSafeAppRouter()
  const { data: session } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    if (!mounted) return
    const routes =
      role === "SUPPLIER"
        ? SUPPLIER_WARM_ROUTES
        : role === "AFFILIATE"
          ? AFFILIATE_WARM_ROUTES
          : BUYER_WARM_ROUTES

    return schedulePrefetchRoutes((href) => prefetch(href), routes)
  }, [mounted, prefetch, role])

  return null
}
