"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

import { ClientNavigateBridge } from "@/components/navigation/client-navigate-bridge"
import { InstantNavigationListener } from "@/components/navigation/instant-navigation-listener"
import { MobileDock } from "@/components/navigation/mobile-dock"
import { NavigationProgress } from "@/components/navigation/navigation-progress"
import { NavigationWarmup } from "@/components/navigation/navigation-warmup"
import { CommandKDeferred } from "@/components/navigation/command-k-deferred"
import { useIdleMount } from "@/hooks/use-idle-mount"

const MobileBuyerHub = dynamic(
  () =>
    import("@/components/marketplace/mobile-buyer-hub").then((m) => ({
      default: m.MobileBuyerHub,
    })),
  { ssr: false }
)

function NavigationWarmupDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 2800, fallbackDelayMs: 700 })
  if (!ready) return null
  return <NavigationWarmup />
}

function MobileBuyerHubDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 3000, fallbackDelayMs: 800 })
  if (!ready) return null
  return <MobileBuyerHub />
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
