"use client"

import useSWR from "swr"

import { EU_CHECKOUT_COUNTRY_COUNT } from "@/lib/eu-market-countries"

type CheckoutStatsResponse = {
  checkoutCountryCount: number
  graduatedCount: number
}

const fetcher = async (url: string): Promise<CheckoutStatsResponse> => {
  try {
    const r = await fetch(url)
    if (!r.ok) {
      return { checkoutCountryCount: EU_CHECKOUT_COUNTRY_COUNT, graduatedCount: 0 }
    }
    return (await r.json()) as CheckoutStatsResponse
  } catch {
    return { checkoutCountryCount: EU_CHECKOUT_COUNTRY_COUNT, graduatedCount: 0 }
  }
}

/** Client hook — live checkout country count including ROW rollouts. */
export function useLiveCheckoutStats() {
  const { data, isLoading } = useSWR<CheckoutStatsResponse>("/api/market/checkout-stats", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  })

  return {
    checkoutCountryCount: data?.checkoutCountryCount ?? EU_CHECKOUT_COUNTRY_COUNT,
    graduatedCount: data?.graduatedCount ?? 0,
    loading: isLoading && !data,
  }
}
