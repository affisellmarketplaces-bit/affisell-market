"use client"

import dynamic from "next/dynamic"

import { useShellIdleMount } from "@/hooks/use-shell-idle-mount"
import { safeDynamicImport } from "@/lib/safe-dynamic-import"

const AnalyticsGated = dynamic(
  () =>
    safeDynamicImport(
      () =>
        import("@/components/legal/analytics-gated").then((m) => ({
          default: m.AnalyticsGated,
        })),
      "AnalyticsGated"
    ),
  { ssr: false }
)

/** Vercel Analytics after idle + cookie consent — off the first-paint bundle. */
export function AnalyticsGatedDeferred() {
  if (process.env.NODE_ENV === "development") return null

  const ready = useShellIdleMount({ idleTimeoutMs: 3000, fallbackDelayMs: 900 })
  if (!ready) return null
  return <AnalyticsGated />
}
