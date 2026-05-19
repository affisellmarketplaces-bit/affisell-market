"use client"

import { Suspense } from "react"

import { MobileDock } from "@/components/navigation/mobile-dock"
import { NavigationProgress } from "@/components/navigation/navigation-progress"
import { NavigationWarmup } from "@/components/navigation/navigation-warmup"
import { QuickNav } from "@/components/navigation/quick-nav"

/** Global instant-nav affordances (progress, prefetch, ⌘K, mobile dock). */
export function NavigationShell() {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <NavigationWarmup />
      <QuickNav />
      <MobileDock />
    </>
  )
}
