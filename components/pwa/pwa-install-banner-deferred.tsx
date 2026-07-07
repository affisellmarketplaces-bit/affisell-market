"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"

const PwaInstallBanner = dynamic(
  () =>
    import("@/components/pwa/pwa-install-banner").then((m) => ({
      default: m.PwaInstallBanner,
    })),
  { ssr: false }
)

/** PWA install prompt — after idle to avoid competing with LCP on mobile home. */
export function PwaInstallBannerDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 1200 })
  if (!ready) return null
  return <PwaInstallBanner />
}
