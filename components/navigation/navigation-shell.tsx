"use client"

import { Suspense } from "react"

import { MobileDock } from "@/components/navigation/mobile-dock"
import { MobileBuyerHub } from "@/components/marketplace/mobile-buyer-hub"
import { NavigationProgress } from "@/components/navigation/navigation-progress"
import { NavigationWarmup } from "@/components/navigation/navigation-warmup"
import { CommandK } from "@/components/CommandK"

/** Global instant-nav affordances (progress, prefetch, ⌘K, mobile dock). */
export function NavigationShell() {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <NavigationWarmup />
      <CommandK showTrigger={false} />
      <MobileBuyerHub />
      <MobileDock />
    </>
  )
}
