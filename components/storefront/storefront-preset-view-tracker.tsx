"use client"

import { useEffect, useRef } from "react"

import { capturePosthogClient } from "@/lib/analytics/posthog"

type Props = {
  storeSlug: string
  presetId?: string | null
}

/** Fires once per mount — Metabase/PostHog preset conversion funnel. */
export function StorefrontPresetViewTracker({ storeSlug, presetId }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    capturePosthogClient("storefront_preset_viewed", {
      storeSlug,
      presetId: presetId ?? "none",
    })
    console.log("[storefront-analytics]", { storeSlug, presetId: presetId ?? "none", event: "view" })
  }, [storeSlug, presetId])

  return null
}
