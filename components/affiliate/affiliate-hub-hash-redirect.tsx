"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { AFFILIATE_HUB_BATTLE_HREF } from "@/lib/affiliate-routes"

/**
 * Legacy Magic Lab deep link `/hub#battle` → exclusive Battle mode.
 */
export function AffiliateHubHashRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash !== "#battle") return
    const mode = new URLSearchParams(window.location.search).get("mode")
    if (mode === "battle") {
      history.replaceState(null, "", AFFILIATE_HUB_BATTLE_HREF)
      return
    }
    router.replace(AFFILIATE_HUB_BATTLE_HREF)
  }, [router])

  return null
}
