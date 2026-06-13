"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { isImmersiveBuyerRoute, shouldHideMobileDock } from "@/lib/mobile-chrome"

const BODY_IMMERSIVE_CLASS = "affisell-immersive-buyer"
const BODY_DOCK_OFF_CLASS = "affisell-mobile-dock-off"

/** Syncs body classes for immersive routes + mobile dock/footer spacing. */
export function ImmersiveChromeSync() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const immersive = isImmersiveBuyerRoute(pathname)
    const dedicated = document.body.classList.contains("affisell-dedicated-storefront")
    const dockOff = immersive || shouldHideMobileDock(pathname) || dedicated
    if (immersive) {
      document.body.classList.add(BODY_IMMERSIVE_CLASS)
    } else {
      document.body.classList.remove(BODY_IMMERSIVE_CLASS)
    }
    document.body.classList.toggle(BODY_DOCK_OFF_CLASS, dockOff)
    return () => {
      document.body.classList.remove(BODY_IMMERSIVE_CLASS)
    }
  }, [pathname])

  return null
}
