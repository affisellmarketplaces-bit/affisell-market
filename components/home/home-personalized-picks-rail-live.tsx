"use client"

import { useEffect } from "react"
import useSWR from "swr"

import { HomePersonalizedPicksRail } from "@/components/home/home-personalized-picks-rail"
import { BUYER_BROWSE_SIGNALS_UPDATED_EVENT } from "@/lib/buyer-browse-signals.client"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"

type Props = {
  initialPicks: BuyerPersonalizedPicksPayload
  className?: string
  variant?: "default" | "compact"
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include", cache: "no-store" }).then(
    (res) => res.json() as Promise<BuyerPersonalizedPicksPayload>
  )

/** SSR picks + live refresh when browse / wishlist signals update. */
export function HomePersonalizedPicksRailLive({
  initialPicks,
  className,
  variant = "default",
}: Props) {
  const { data, mutate } = useSWR<BuyerPersonalizedPicksPayload>(
    "/api/buyer/personalized-picks",
    fetcher,
    {
      fallbackData: initialPicks,
      revalidateOnFocus: false,
      revalidateOnMount: false,
      dedupingInterval: 5_000,
    }
  )

  useEffect(() => {
    const onSignalsUpdated = () => {
      void mutate()
    }
    window.addEventListener(BUYER_BROWSE_SIGNALS_UPDATED_EVENT, onSignalsUpdated)
    return () => window.removeEventListener(BUYER_BROWSE_SIGNALS_UPDATED_EVENT, onSignalsUpdated)
  }, [mutate])

  const picks = data ?? initialPicks

  return (
    <HomePersonalizedPicksRail picks={picks} className={className} variant={variant} />
  )
}
