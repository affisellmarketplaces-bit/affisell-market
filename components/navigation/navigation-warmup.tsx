"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

import {
  AFFILIATE_WARM_ROUTES,
  BUYER_MOBILE_WARM_ROUTES,
  BUYER_WARM_ROUTES,
  SUPPLIER_WARM_ROUTES,
} from "@/lib/nav-routes"
import { schedulePrefetchRoutes } from "@/lib/prefetch-routes"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

function resolveWarmRoutes(role: string | undefined, mobile: boolean): readonly string[] {
  if (role === "SUPPLIER") return SUPPLIER_WARM_ROUTES
  if (role === "AFFILIATE") return AFFILIATE_WARM_ROUTES
  return mobile ? BUYER_MOBILE_WARM_ROUTES : BUYER_WARM_ROUTES
}

/** Prefetch key routes once per session so first clicks feel instant. */
export function NavigationWarmup() {
  const { prefetch, mounted } = useSafeAppRouter()
  const { data: session } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    if (!mounted) return
    const mobile = window.matchMedia("(max-width: 767px)").matches
    const routes = resolveWarmRoutes(role, mobile)

    return schedulePrefetchRoutes((href) => prefetch(href), routes, {
      idleTimeoutMs: mobile ? 6500 : 5500,
      fallbackDelayMs: mobile ? 2800 : 2200,
    })
  }, [mounted, prefetch, role])

  return null
}
