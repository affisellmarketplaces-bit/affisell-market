"use client"

import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"

import { canSeeHomeMerchantRadar } from "@/lib/role-feature-matrix"

/**
 * Below-fold Radar marketing blocks — excluded from initial JS/HTML.
 * Cuts TBT + DOM on first paint (World Radar + Producteur/Grossiste).
 * Hidden for logged-in buyers (merchant acquisition only).
 */
const WorldRadarPro = dynamic(
  () =>
    import("@/components/home/WorldRadarPro").then((m) => ({
      default: m.WorldRadarPro,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-4 min-h-[28rem] rounded-3xl border border-white/5 bg-[#080810]/50 sm:mt-8"
        aria-hidden
      />
    ),
  }
)

const HomeRadarTeaser = dynamic(
  () =>
    import("@/components/home/home-radar-teaser").then((m) => ({
      default: m.HomeRadarTeaser,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 min-h-[32rem] rounded-3xl bg-zinc-950/5 sm:mt-8" aria-hidden />
    ),
  }
)

export function HomeBelowFoldRadars() {
  const { data: session, status } = useSession()
  if (status === "authenticated" && !canSeeHomeMerchantRadar(session?.user?.role)) {
    return null
  }

  return (
    <>
      <WorldRadarPro />
      <HomeRadarTeaser />
    </>
  )
}
