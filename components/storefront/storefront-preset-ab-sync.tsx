"use client"

import { useEffect, useRef, useState } from "react"

import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  pickPresetAbVariant,
  resolvePresetAbTheme,
  type StorefrontPresetAb,
} from "@/lib/storefront-preset-ab-shared"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"

type Props = {
  storeSlug: string
  controlPresetId: string | null | undefined
  controlTheme: StorefrontTheme
  presetAb: StorefrontPresetAb | null | undefined
}

function sessionKeyForSlug(slug: string): string {
  const key = `affisell_ab_${slug}`
  if (typeof window === "undefined") return key
  let existing = sessionStorage.getItem(key)
  if (!existing) {
    existing = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, existing)
  }
  return existing
}

/** 50/50 preset split for buyers + impression tracking. */
export function StorefrontPresetAbSync({
  storeSlug,
  controlPresetId,
  controlTheme,
  presetAb,
}: Props) {
  const firedRef = useRef(false)
  const [resolved, setResolved] = useState<{
    theme: StorefrontTheme
    effectivePresetId: string | null
    variant: "control" | "challenger"
  } | null>(null)

  useEffect(() => {
    if (!presetAb?.enabled) {
      setResolved(null)
      return
    }
    const sessionKey = sessionKeyForSlug(storeSlug)
    const variant = pickPresetAbVariant(sessionKey)
    const out = resolvePresetAbTheme({
      controlTheme,
      controlPresetId,
      presetAb,
      variant,
    })
    setResolved({ ...out, variant })
  }, [controlPresetId, controlTheme, presetAb, storeSlug])

  useEffect(() => {
    if (!resolved || !presetAb?.enabled || firedRef.current) return
    firedRef.current = true

    capturePosthogClient("storefront_preset_ab_viewed", {
      storeSlug,
      variant: resolved.variant,
      presetId: resolved.effectivePresetId ?? "none",
      controlPresetId: controlPresetId ?? "none",
      challengerPresetId: presetAb.challengerPresetId,
    })

    void fetch("/api/store/preset-ab-impression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: storeSlug, variant: resolved.variant }),
    }).catch(() => {
      /* non-blocking */
    })

    console.log("[storefront-analytics]", {
      storeSlug,
      event: "preset_ab_viewed",
      variant: resolved.variant,
      presetId: resolved.effectivePresetId,
    })
  }, [controlPresetId, presetAb, resolved, storeSlug])

  if (!resolved || resolved.variant === "control") return null

  return <StorefrontThemeStyles theme={resolved.theme} />
}
