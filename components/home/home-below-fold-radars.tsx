"use client"

import dynamic from "next/dynamic"

/**
 * Below-fold Radar marketing blocks — excluded from initial JS/HTML.
 * Cuts TBT + DOM on first paint (World Radar + Producteur/Grossiste).
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
        className="mt-4 min-h-[28rem] rounded-3xl border border-white/5 bg-[#0a0a0f]/40 sm:mt-8"
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
  return (
    <>
      {/* Visible on mobile too — WTF moment after product grid (~363px). */}
      <WorldRadarPro className="mt-4 sm:mt-8" />
      <HomeRadarTeaser className="mt-4 sm:mt-8" />
    </>
  )
}
