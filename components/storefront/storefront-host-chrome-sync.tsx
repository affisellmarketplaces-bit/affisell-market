"use client"

import { useEffect } from "react"

const BODY_DEDICATED_CLASS = "affisell-dedicated-storefront"
const BODY_DOCK_OFF_CLASS = "affisell-mobile-dock-off"

/** Sync dedicated storefront body classes (hide platform header + buyer dock). */
export function StorefrontHostChromeSync({ active }: { active: boolean }) {
  useEffect(() => {
    document.body.classList.toggle(BODY_DEDICATED_CLASS, active)
    document.body.classList.toggle(BODY_DOCK_OFF_CLASS, active)
    return () => {
      document.body.classList.remove(BODY_DEDICATED_CLASS)
      document.body.classList.remove(BODY_DOCK_OFF_CLASS)
    }
  }, [active])

  return null
}
