"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

import { ClientNavigateBridge } from "@/components/navigation/client-navigate-bridge"
import { InstantNavigationListener } from "@/components/navigation/instant-navigation-listener"
import { MobileDock } from "@/components/navigation/mobile-dock"
import { NavigationProgress } from "@/components/navigation/navigation-progress"
import { NavigationWarmup } from "@/components/navigation/navigation-warmup"
import { CommandKDeferred } from "@/components/navigation/command-k-deferred"
import { useShellIdleMount } from "@/hooks/use-shell-idle-mount"
import { safeDynamicImport } from "@/lib/safe-dynamic-import"

const MobileBuyerHub = dynamic(
  () =>
    safeDynamicImport(
      () =>
        import("@/components/marketplace/mobile-buyer-hub").then((m) => ({
          default: m.MobileBuyerHub,
        })),
      "MobileBuyerHub"
    ),
  { ssr: false }
)

const MobileSearchOverlay = dynamic(
  () =>
    safeDynamicImport(
      () =>
        import("@/components/nav/mobile-search-overlay").then((m) => ({
          default: m.MobileSearchOverlay,
        })),
      "MobileSearchOverlay"
    ),
  { ssr: false }
)

function NavigationWarmupDeferred() {
  const ready = useShellIdleMount({ idleTimeoutMs: 2800, fallbackDelayMs: 700 })
  if (!ready) return null
  return <NavigationWarmup />
}

function MobileBuyerHubDeferred() {
  const ready = useShellIdleMount({ idleTimeoutMs: 3000, fallbackDelayMs: 800 })
  if (!ready) return null
  return (
    <>
      <MobileBuyerHub />
      <MobileSearchOverlay />
    </>
  )
}

/** Global instant-nav affordances (progress, prefetch, ⌘K, mobile dock). */
export function NavigationShell() {
  return (
    <>
      <ClientNavigateBridge />
      <InstantNavigationListener />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <NavigationWarmupDeferred />
      <CommandKDeferred />
      <MobileBuyerHubDeferred />
      <MobileDock />
    </>
  )
}
