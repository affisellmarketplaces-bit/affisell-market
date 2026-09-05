"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale } from "next-intl"
import useSWR from "swr"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { catalogFilterHrefFromParams, navigateMarketplaceCatalog } from "@/lib/marketplace-catalog-nav.client"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"
import { offerFacetSlug, offerModeFilterLabel, type ProductOfferMode } from "@/lib/product-offer-mode"
import type { AppLocale } from "@/lib/i18n-locale"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

const RAIL_MODES: ProductOfferMode[] = [
  "STANDARD",
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
]

const DISPLAY_LABEL: Record<ProductOfferMode, string> = {
  STANDARD: "New",
  REFURBISHED: "Refurbished",
  SECOND_HAND: "Pre-owned",
  WHOLESALE_ONLY: "Bulk",
  DONATION: "Donation",
}

type Props = {
  basePath?: string
  initialCounts?: Record<string, number>
  className?: string
}

const countsFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ counts?: Record<string, number> }>

/** Product condition filter row — premium home (ref-full-decoupage). */
export function ProductConditionFilterBar({ basePath = "/", initialCounts, className }: Props) {
  const locale = resolveAppLocale(useLocale())
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const activeOffer = searchParams.get(MARKETPLACE_OFFER_FACET_KEY)
  const targetPath = basePath ?? pathname
  const [countsHydrated, setCountsHydrated] = useState(false)

  useEffect(() => {
    setCountsHydrated(true)
  }, [])

  const countsUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(MARKETPLACE_OFFER_FACET_KEY)
    params.delete("lite")
    const qs = params.toString()
    return `/api/marketplace/offer-rail-counts${qs ? `?${qs}` : ""}`
  }, [searchParams])

  const { data: countsData } = useSWR(countsUrl, countsFetcher, {
    revalidateOnFocus: false,
    fallbackData: initialCounts ? { counts: initialCounts } : undefined,
  })
  const offerCounts = countsData?.counts ?? initialCounts ?? {}

  const pushParams = (next: URLSearchParams) => {
    navigateMarketplaceCatalog(router, catalogFilterHrefFromParams(targetPath, next))
  }

  const toggle = (slug: string, count: number | null) => {
    if (count === 0) return
    const next = new URLSearchParams(searchParams.toString())
    if (activeOffer === slug) next.delete(MARKETPLACE_OFFER_FACET_KEY)
    else next.set(MARKETPLACE_OFFER_FACET_KEY, slug)
    pushParams(next)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: PREMIUM_MARKETPLACE_HOME.conditionLabel }}
      >
        <span>Product condition</span>
        <span className="hidden h-3 w-px bg-slate-300 sm:inline" aria-hidden />
        <span style={{ color: PREMIUM_MARKETPLACE_HOME.panelMuted }}>Filter by condition</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {RAIL_MODES.map((mode) => {
          const slug = offerFacetSlug(mode)
          if (!slug) return null
          const countKey = slug === "new" ? "new" : slug
          const count = offerCounts[countKey] ?? offerCounts[slug] ?? null
          const disabled = countsHydrated && count === 0
          const active = activeOffer === slug
          const label =
            DISPLAY_LABEL[mode] ??
            offerModeFilterLabel(mode, locale as AppLocale)?.shortLabel ??
            mode

          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => toggle(slug, count)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                disabled && "cursor-not-allowed opacity-45",
                active
                  ? "text-white shadow-md"
                  : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              )}
              style={active ? { backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive } : undefined}
            >
              {label}
              {count != null && count > 0 ? (
                <span className={cn("tabular-nums", active ? "text-white/90" : "text-slate-500")}>
                  {label === "New" ? `${count} listings` : `(${count})`}
                </span>
              ) : disabled ? (
                <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">
                  No listings yet
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
