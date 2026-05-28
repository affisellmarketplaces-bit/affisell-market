"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { isImmersiveBuyerRoute } from "@/lib/mobile-chrome"

const BODY_CLASS = "affisell-immersive-buyer"

/** Hides global header/footer on mobile for full-screen buyer routes (Pulse, Luxe, …). */
export function ImmersiveChromeSync() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const immersive = isImmersiveBuyerRoute(pathname)
    document.body.classList.toggle(BODY_CLASS, immersive)
    return () => {
      document.body.classList.remove(BODY_CLASS)
    }
  }, [pathname])

  return null
}
