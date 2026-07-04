"use client"

import { useEffect, useRef } from "react"

import { capturePosthogClient } from "@/lib/analytics/posthog"

type Props = {
  storeSlug: string
  presetId?: string | null
  heroStyle?: string | null
}

/** Fires once per mount — immersive layout conversion funnel. */
export function StorefrontImmersiveViewTracker({ storeSlug, presetId, heroStyle }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    capturePosthogClient("storefront_immersive_viewed", {
      storeSlug,
      presetId: presetId ?? "none",
      heroStyle: heroStyle ?? "banner",
    })
    console.log("[storefront-analytics]", {
      storeSlug,
      presetId: presetId ?? "none",
      heroStyle: heroStyle ?? "banner",
      event: "immersive_view",
    })
  }, [storeSlug, presetId, heroStyle])

  return null
}
