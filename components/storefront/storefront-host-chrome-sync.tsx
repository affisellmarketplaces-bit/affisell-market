"use client"

import { useEffect } from "react"

const BODY_STOREFRONT_CLASS = "affisell-immersive-buyer"

/** Hide global Affisell header/footer on merchant hosts (custom domain + auto subdomain). */
export function StorefrontHostChromeSync({ active }: { active: boolean }) {
  useEffect(() => {
    document.body.classList.toggle(BODY_STOREFRONT_CLASS, active)
    return () => {
      document.body.classList.remove(BODY_STOREFRONT_CLASS)
    }
  }, [active])

  return null
}
