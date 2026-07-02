"use client"

import { HomePersonalizedPicksRailLive } from "@/components/home/home-personalized-picks-rail-live"
import { usePostCheckoutRecommendedPicks } from "@/components/account/account-orders-shopping-cta.client"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"

const EMPTY_PICKS: BuyerPersonalizedPicksPayload = {
  items: [],
  personalized: false,
}

/** Post-checkout orders page: relaunch discovery in-place with fresh personalized picks. */
export function AccountOrdersRecommendedRail() {
  const postCheckout = usePostCheckoutRecommendedPicks()
  if (!postCheckout) return null

  return (
    <HomePersonalizedPicksRailLive
      initialPicks={EMPTY_PICKS}
      className="mt-2"
    />
  )
}
