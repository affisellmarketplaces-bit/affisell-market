"use client"

import { useEffect } from "react"

import { registerClientNavigate } from "@/lib/client-navigate.client"
import { runSafeRouterPush } from "@/lib/safe-app-router"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

/** Registers `clientNavigate` for libs outside React (cart fallback, etc.). */
export function ClientNavigateBridge() {
  const { router, mounted } = useSafeAppRouter()

  useEffect(() => {
    if (!mounted) return
    registerClientNavigate((href) => {
      runSafeRouterPush(router, href)
    })
    return () => registerClientNavigate(null)
  }, [mounted, router])

  return null
}
