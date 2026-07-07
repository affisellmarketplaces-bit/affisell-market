"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"

const CookieBanner = dynamic(() => import("@/components/CookieBanner"), { ssr: false })

/** Cookie UI after idle — keeps consent off the LCP/TBT critical path. */
export function CookieBannerDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 900 })
  if (!ready) return null
  return <CookieBanner />
}
