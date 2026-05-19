"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import {
  AFFILIATE_WARM_ROUTES,
  BUYER_WARM_ROUTES,
  SUPPLIER_WARM_ROUTES,
} from "@/lib/nav-routes"

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

    const run = () => {
      for (const path of routes) {
        try {
          router.prefetch(path)
        } catch {
          /* ignore */
        }
      }
    }

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 400)
    return () => window.clearTimeout(t)
  }, [router, role])

  return null
}
