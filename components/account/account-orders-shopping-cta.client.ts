"use client"

import { useEffect, useState } from "react"

import { readBuyerPersonalizationRefreshPending } from "@/lib/buyer-personalization-refresh.client"

/** True when a recent checkout left a pending personalization refresh flag. */
export function usePostCheckoutRecommendedPicks(): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(readBuyerPersonalizationRefreshPending() === "checkout_success")
  }, [])

  return active
}
