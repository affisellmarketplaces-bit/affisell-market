"use client"

import dynamic from "next/dynamic"

import { useShellIdleMount } from "@/hooks/use-shell-idle-mount"
import { safeDynamicImport } from "@/lib/safe-dynamic-import"

const PwaInstallBanner = dynamic(
  () =>
    safeDynamicImport(
      () =>
        import("@/components/pwa/pwa-install-banner").then((m) => ({
          default: m.PwaInstallBanner,
        })),
      "PwaInstallBanner"
    ),
  { ssr: false }
)

/** PWA install prompt — after idle to avoid competing with LCP on mobile home. */
export function PwaInstallBannerDeferred() {
  if (process.env.NODE_ENV === "development") return null

  const ready = useShellIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 1200 })
  if (!ready) return null
  return <PwaInstallBanner />
}
