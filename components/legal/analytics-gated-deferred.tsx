"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"

const AnalyticsGated = dynamic(
  () => import("@/components/legal/analytics-gated").then((m) => ({ default: m.AnalyticsGated })),
  { ssr: false }
)

/** Vercel Analytics after idle + cookie consent — off the first-paint bundle. */
export function AnalyticsGatedDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 3000, fallbackDelayMs: 900 })
  if (!ready) return null
  return <AnalyticsGated />
}
