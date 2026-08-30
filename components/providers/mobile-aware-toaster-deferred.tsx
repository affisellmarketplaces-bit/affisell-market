"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"

const MobileAwareToaster = dynamic(
  () =>
    import("@/components/providers/mobile-aware-toaster").then((m) => ({
      default: m.MobileAwareToaster,
    })),
  { ssr: false }
)

/** Sonner after idle — toasts are not needed for first paint. */
export function MobileAwareToasterDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 2400, fallbackDelayMs: 600 })
  if (!ready) return null
  return <MobileAwareToaster />
}
