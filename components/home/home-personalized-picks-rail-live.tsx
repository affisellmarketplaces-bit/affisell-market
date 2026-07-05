"use client"

import { useEffect } from "react"
import useSWR from "swr"

import { HomePersonalizedPicksRail } from "@/components/home/home-personalized-picks-rail"
import {
  BUYER_PERSONALIZATION_REFRESH_EVENT,
  BUYER_PERSONALIZATION_REFRESH_PENDING_KEY,
  consumeBuyerPersonalizationRefreshPending,
} from "@/lib/buyer-personalization-refresh.client"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"

type Props = {
  initialPicks: BuyerPersonalizedPicksPayload
  className?: string
  variant?: "default" | "compact" | "pulse"
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
    const refreshPicks = () => {
      void mutate()
    }
    const pending = consumeBuyerPersonalizationRefreshPending()
    if (pending) refreshPicks()
    window.addEventListener(BUYER_PERSONALIZATION_REFRESH_EVENT, refreshPicks)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== BUYER_PERSONALIZATION_REFRESH_PENDING_KEY || !event.newValue) return
      refreshPicks()
    }
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(BUYER_PERSONALIZATION_REFRESH_EVENT, refreshPicks)
      window.removeEventListener("storage", onStorage)
    }
  }, [mutate])

  const picks = data ?? initialPicks

  return (
    <HomePersonalizedPicksRail picks={picks} className={className} variant={variant} />
  )
}
