"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  runSafeRouterPrefetch,
  runSafeRouterPush,
  runSafeRouterRefresh,
  runSafeRouterReplace,
} from "@/lib/safe-app-router"

/**
 * App Router wrapper — defers push/replace/prefetch until after hydration.
 * Use in useEffect with `[mounted, …]` or call safe methods from handlers.
 */
export function useSafeAppRouter() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      if (!mounted) return
      runSafeRouterPush(router, href, options)
    },
    [mounted, router]
  )

  const replace = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      if (!mounted) return
      runSafeRouterReplace(router, href, options)
    },
    [mounted, router]
  )

  const prefetch = useCallback(
    (href: string) => {
      if (!mounted) return
      runSafeRouterPrefetch(router, href)
    },
    [mounted, router]
  )

  const refresh = useCallback(() => {
    if (!mounted) return
    runSafeRouterRefresh(router)
  }, [mounted, router])

  return { router, mounted, push, replace, prefetch, refresh }
}
