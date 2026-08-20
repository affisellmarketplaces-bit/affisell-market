"use client"

import dynamic from "next/dynamic"

import { useShellIdleMount } from "@/hooks/use-shell-idle-mount"
import { safeDynamicImport } from "@/lib/safe-dynamic-import"

const CookieBanner = dynamic(
  () => safeDynamicImport(() => import("@/components/CookieBanner"), "CookieBanner"),
  { ssr: false }
)

/** Cookie UI after idle — keeps consent off the LCP/TBT critical path. */
export function CookieBannerDeferred() {
  const ready = useShellIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 900 })
  if (!ready) return null
  return <CookieBanner />
}
