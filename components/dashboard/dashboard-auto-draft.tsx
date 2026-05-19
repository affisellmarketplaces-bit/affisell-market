"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { flushAllMerchantDrafts } from "@/lib/merchant-draft-flush"

/**
 * Flushes registered merchant drafts when leaving `/dashboard` or when the tab is hidden.
 */
export function DashboardAutoDraft() {
  const pathname = usePathname() ?? ""
  const prevPath = useRef(pathname)

  useEffect(() => {
    const wasInDashboard = prevPath.current.startsWith("/dashboard")
    const nowInDashboard = pathname.startsWith("/dashboard")
    if (wasInDashboard && !nowInDashboard) {
      void flushAllMerchantDrafts()
    }
    prevPath.current = pathname
  }, [pathname])

  useEffect(() => {
    const onPageHide = () => {
      if (!window.location.pathname.startsWith("/dashboard")) return
      void flushAllMerchantDrafts()
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [])

  return null
}
