"use client"

import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"

import { useIdleInViewMount } from "@/hooks/use-idle-in-view-mount"
import { canSeeHomeMerchantRadar } from "@/lib/role-feature-matrix"

/**
 * Below-fold Radar marketing blocks — mount only in-view or after idle.
 * Cuts TBT on buyer home (World Radar + Producteur/Grossiste are heavy).
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

function BelowFoldRadarPlaceholder() {
  return (
    <div
      className="mt-4 min-h-[28rem] rounded-3xl border border-white/5 bg-[#080810]/30 sm:mt-8"
      aria-hidden
    />
  )
}

export function HomeBelowFoldRadars() {
  const { data: session, status } = useSession()
  const { ref, ready } = useIdleInViewMount({
    idleTimeoutMs: 10_000,
    fallbackDelayMs: 5000,
    rootMargin: "120px 0px",
  })

  if (status === "authenticated" && !canSeeHomeMerchantRadar(session?.user?.role)) {
    return null
  }

  return (
    <div ref={ref} className="min-w-0">
      {ready ? (
        <>
          <WorldRadarPro />
          <HomeRadarTeaser />
        </>
      ) : (
        <BelowFoldRadarPlaceholder />
      )}
    </div>
  )
}
