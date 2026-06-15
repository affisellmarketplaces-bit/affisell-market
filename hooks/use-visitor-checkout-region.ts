"use client"

import useSWR from "swr"

type VisitorRegionResponse = {
  country: string | null
  checkoutAvailable: boolean
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<VisitorRegionResponse>

export function useVisitorCheckoutRegion() {
  const { data, isLoading } = useSWR<VisitorRegionResponse>("/api/market/visitor-region", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  })

  return {
    country: data?.country ?? null,
    checkoutAvailable: data?.checkoutAvailable ?? true,
    loading: isLoading && !data,
  }
}
