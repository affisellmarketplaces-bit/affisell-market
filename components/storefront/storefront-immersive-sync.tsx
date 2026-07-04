"use client"

import { useEffect } from "react"

import { STOREFRONT_IMMERSIVE_ROOT_CLASS } from "@/lib/storefront-immersive-shared"

/** Syncs immersive storefront body class for scroll/ambient CSS hooks. */
export function StorefrontImmersiveSync({ active }: { active: boolean }) {
  useEffect(() => {
    document.body.classList.toggle(STOREFRONT_IMMERSIVE_ROOT_CLASS, active)
    return () => {
      document.body.classList.remove(STOREFRONT_IMMERSIVE_ROOT_CLASS)
    }
  }, [active])

  return null
}
