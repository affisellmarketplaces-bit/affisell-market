"use client"

import dynamic from "next/dynamic"

/**
 * Below-fold Radar marketing blocks — excluded from initial JS/HTML.
 * Cuts TBT + DOM on first paint (World Radar ~974px + Producteur/Grossiste).
 */
const HomeWorldRadarTeaser = dynamic(
  () =>
    import("@/components/home/home-world-radar-teaser").then((m) => ({
      default: m.HomeWorldRadarTeaser,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-4 hidden min-h-[28rem] rounded-3xl bg-zinc-950/5 sm:mt-8 md:block"
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
      <HomeWorldRadarTeaser className="mt-4 hidden sm:mt-8 md:block" />
      <HomeRadarTeaser className="mt-4 sm:mt-8" />
    </>
  )
}
