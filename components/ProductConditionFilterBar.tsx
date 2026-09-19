"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { catalogFilterHrefFromParams, navigateMarketplaceCatalog } from "@/lib/marketplace-catalog-nav.client"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"
import { offerFacetSlug, type ProductOfferMode } from "@/lib/product-offer-mode"
import { cn } from "@/lib/utils"

const RAIL_MODES: ProductOfferMode[] = [
  "STANDARD",
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
]

const LABEL_KEY: Record<ProductOfferMode, string> = {
  STANDARD: "standard",
  REFURBISHED: "refurbished",
  SECOND_HAND: "second_hand",
  WHOLESALE_ONLY: "wholesale",
  DONATION: "donation",
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
  const t = useTranslations("homeQuick")
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const activeOffer = searchParams.get(MARKETPLACE_OFFER_FACET_KEY)
  const targetPath = basePath ?? pathname
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

  // Only conditions that actually have listings (or are already selected) are worth showing;
  // when there is nothing to choose between, the whole bar is noise and stays out of the way.
  const options = RAIL_MODES.flatMap((mode) => {
    const slug = offerFacetSlug(mode)
    if (!slug) return []
    const count = offerCounts[slug] ?? null
    const active = activeOffer === slug
    return (count ?? 0) > 0 || active ? [{ mode, slug, count, active }] : []
  })
  if (options.length <= 1 && !options.some((o) => o.active)) return null

  return (
    <div className={cn("space-y-2", className)} role="group" aria-label={t("conditionTitle")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{t("conditionTitle")}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ mode, slug, count, active }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(slug, count)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition max-lg:min-h-11",
              active ? "text-white shadow-md" : "bg-slate-100 text-slate-700 hover:bg-slate-200/90"
            )}
            style={active ? { backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive } : undefined}
          >
            {t(`condition.${LABEL_KEY[mode]}`)}
            {count != null && count > 0 ? (
              <span className={cn("tabular-nums", active ? "text-white/90" : "text-slate-500")}>({count})</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
