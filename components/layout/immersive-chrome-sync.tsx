"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import {
  isImmersiveBuyerRoute,
  isPulseFullscreenRoute,
  shouldHideMobileDock,
} from "@/lib/mobile-chrome"
import { isBuyerPremiumHomePathname } from "@/lib/buyer-premium-home-route"

const BODY_IMMERSIVE_CLASS = "affisell-immersive-buyer"
const BODY_PULSE_FULLSCREEN_CLASS = "affisell-pulse-fullscreen"
const BODY_DOCK_OFF_CLASS = "affisell-mobile-dock-off"
const BODY_BUYER_PREMIUM_HOME_CLASS = "affisell-buyer-premium-home"

/** Syncs body classes for immersive routes + mobile dock/footer spacing. */
export function ImmersiveChromeSync() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const immersive = isImmersiveBuyerRoute(pathname)
    const pulseFullscreen = isPulseFullscreenRoute(pathname)
    const buyerPremiumHome = isBuyerPremiumHomePathname(pathname)
    const dedicated = document.body.classList.contains("affisell-dedicated-storefront")
    const dockOff = immersive || shouldHideMobileDock(pathname) || dedicated
    document.body.classList.toggle(BODY_IMMERSIVE_CLASS, immersive)
    document.body.classList.toggle(BODY_PULSE_FULLSCREEN_CLASS, pulseFullscreen)
    document.body.classList.toggle(BODY_BUYER_PREMIUM_HOME_CLASS, buyerPremiumHome)
    document.body.classList.toggle(BODY_DOCK_OFF_CLASS, dockOff)
    return () => {
      document.body.classList.remove(BODY_IMMERSIVE_CLASS)
      document.body.classList.remove(BODY_PULSE_FULLSCREEN_CLASS)
      document.body.classList.remove(BODY_BUYER_PREMIUM_HOME_CLASS)
    }
  }, [pathname])

  return null
}
