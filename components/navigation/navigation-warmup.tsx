"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import {
  AFFILIATE_WARM_ROUTES,
  BUYER_WARM_ROUTES,
  SUPPLIER_WARM_ROUTES,
} from "@/lib/nav-routes"
import { schedulePrefetchRoutes } from "@/lib/prefetch-routes"

/** Prefetch key routes once per session so first clicks feel instant. */
export function NavigationWarmup() {
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    const routes =
      role === "SUPPLIER"
        ? SUPPLIER_WARM_ROUTES
        : role === "AFFILIATE"
          ? AFFILIATE_WARM_ROUTES
          : BUYER_WARM_ROUTES

    return schedulePrefetchRoutes((href) => router.prefetch(href), routes)
  }, [router, role])

  return null
}
