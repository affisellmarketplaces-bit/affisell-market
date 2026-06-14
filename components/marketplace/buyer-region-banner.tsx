"use client"

import useSWR from "swr"

import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { EuCoverageBanner } from "@/components/marketplace/eu-coverage-banner"

type VisitorRegionResponse = {
  country: string | null
  checkoutAvailable: boolean
}

type Props = {
  className?: string
  variant?: "buyer" | "compact"
  /** SSR: skip fetch and pick banner immediately. */
  visitorCountry?: string | null
  checkoutAvailable?: boolean
}

const regionFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<VisitorRegionResponse>

/** Pan-EU trust strip or coming-soon reassurance based on visitor geo. */
export function BuyerRegionBanner({
  className,
  variant = "buyer",
  visitorCountry: ssrCountry,
  checkoutAvailable: ssrCheckoutAvailable,
}: Props) {
  const shouldFetch = ssrCountry === undefined && ssrCheckoutAvailable === undefined

  const { data, isLoading } = useSWR<VisitorRegionResponse>(
    shouldFetch ? "/api/market/visitor-region" : null,
    regionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  )

  const country = ssrCountry ?? data?.country ?? null
  const checkoutAvailable = ssrCheckoutAvailable ?? data?.checkoutAvailable ?? true

  if (shouldFetch && isLoading && !data) return null

  if (country && !checkoutAvailable) {
    return (
      <CheckoutRegionComingSoonBanner
        className={className}
        variant={variant}
        visitorCountry={country}
        checkoutAvailable={false}
      />
    )
  }

  return <EuCoverageBanner className={className} variant={variant} />
}
