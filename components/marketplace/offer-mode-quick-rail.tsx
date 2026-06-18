"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Package, Recycle, RefreshCw, Sparkles, X } from "lucide-react"
import useSWR from "swr"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { catalogFilterHrefFromParams, navigateMarketplaceCatalog } from "@/lib/marketplace-catalog-nav.client"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { offerFacetSlug, offerModeFilterLabel, type ProductOfferMode } from "@/lib/product-offer-mode"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

const RAIL_MODES: ProductOfferMode[] = [
  "STANDARD",
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
]

const RAIL_ICONS = {
  STANDARD: Sparkles,
  REFURBISHED: Recycle,
  SECOND_HAND: RefreshCw,
  WHOLESALE_ONLY: Package,
  DONATION: Gift,
} as const

const ICON_ACCENT = BUYER_TILE_ACCENTS.catalog.icon

type OfferModeSlug = "new" | "refurbished" | "second_hand" | "wholesale" | "donation"

type Props = {
  basePath?: string
  className?: string
  /** SSR counts — keeps server/client markup aligned on first paint. */
  initialCounts?: Record<string, number>
}

const countsFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ counts?: Record<string, number> }>

export function OfferModeQuickRail({ basePath, className, initialCounts }: Props) {
  const t = useTranslations("marketplace.browse.offerRail")
  const locale = useLocale()
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
    dedupingInterval: 30_000,
    fallbackData: initialCounts ? { counts: initialCounts } : undefined,
  })
  const offerCounts = countsData?.counts ?? initialCounts ?? {}
  const countsReady = countsHydrated && (countsData !== undefined || initialCounts !== undefined)

  const pushParams = (next: URLSearchParams) => {
    navigateMarketplaceCatalog(router, catalogFilterHrefFromParams(targetPath, next))
  }

  const toggle = (slug: string, count: number | null) => {
    if (countsReady && count !== null && count <= 0 && activeOffer !== slug) return
    const next = new URLSearchParams(searchParams.toString())
    const deselect = activeOffer === slug
    if (deselect) next.delete(MARKETPLACE_OFFER_FACET_KEY)
    else next.set(MARKETPLACE_OFFER_FACET_KEY, slug)
    console.log("[offer-rail]", {
      action: deselect ? "deselect" : "select",
      offer: slug,
      path: targetPath,
    })
    pushParams(next)
  }

  const clear = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete(MARKETPLACE_OFFER_FACET_KEY)
    console.log("[offer-rail]", {
      action: "clear",
      previousOffer: activeOffer,
      path: targetPath,
    })
    pushParams(next)
  }

  return (
    <section className={cn("affisell-offer-mode-rail", className)} aria-label={t("eyebrow")}>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex size-2 shrink-0 motion-reduce:hidden" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/40 opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-brand shadow-[0_0_10px_color-mix(in_srgb,var(--brand)_55%,transparent)]" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand dark:text-brand-light">
            {t("eyebrow")}
          </p>
        </div>
        {activeOffer ? (
          <button
            type="button"
            onClick={clear}
            className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-brand/20 bg-brand-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand backdrop-blur-sm transition hover:border-brand/35 hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand/35 dark:bg-brand-muted/30 dark:text-brand-light"
          >
            <X className="size-3 shrink-0 opacity-70" aria-hidden />
            {t("clear")}
          </button>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:tracking-[0.16em] dark:text-zinc-400">
            <Sparkles className="size-3 shrink-0 text-brand dark:text-brand-light" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("tapHint")}</span>
          </span>
        )}
      </div>

      <div
        className="affisell-offer-mode-rail-scroll flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:gap-2.5 sm:overflow-visible sm:pb-0.5"
        role="tablist"
        aria-label={t("eyebrow")}
      >
        {RAIL_MODES.map((mode) => {
          const slug = offerFacetSlug(mode)
          const badge = offerModeFilterLabel(mode, locale as AppLocale)
          if (!slug || !badge) return null
          const Icon = RAIL_ICONS[mode as keyof typeof RAIL_ICONS]
          const active = activeOffer === slug
          const count = countsReady ? (offerCounts[slug] ?? 0) : null
          const disabled = countsReady && count !== null && count <= 0 && !active
          const subtitle =
            !countsReady || count === null
              ? badge.label
              : count > 0
                ? t("listingCount", { count })
                : t("noListingsForMode")
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              data-mode={slug as OfferModeSlug}
              data-active={active ? "true" : "false"}
              aria-selected={active}
              aria-pressed={active}
              aria-disabled={disabled || undefined}
              title={disabled ? t("noListingsForMode") : badge.label}
              onClick={() => toggle(slug, count)}
              className={cn(
                "affisell-offer-mode-card group relative flex min-h-11 min-w-[5.75rem] max-w-[8.5rem] flex-1 shrink-0 snap-center items-center gap-2 overflow-hidden rounded-2xl px-2.5 py-2 text-left transition duration-300 sm:min-h-[3.5rem] sm:min-w-0 sm:max-w-none sm:flex-1 sm:px-3",
                disabled
                  ? "pointer-events-none cursor-not-allowed opacity-45 grayscale-[0.35]"
                  : "hover:-translate-y-0.5 active:scale-[0.98]"
              )}
            >
              {countsReady && count !== null && count > 0 ? (
                <span
                  className="absolute right-1 top-1 z-10 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none text-white shadow-sm sm:hidden"
                  aria-hidden
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
              <span
                className={cn(
                  "pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-gradient-to-br opacity-35 blur-2xl transition group-hover:opacity-55 sm:h-20 sm:w-20",
                  BUYER_TILE_ACCENTS.catalog.glow
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-inner sm:h-8 sm:w-8 sm:rounded-xl",
                  ICON_ACCENT
                )}
              >
                <Icon className="size-3.5 text-white" aria-hidden />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold leading-snug text-zinc-900 sm:text-xs dark:text-white">
                  {badge.shortLabel}
                </span>
                <span className="mt-0.5 hidden truncate text-[10px] leading-snug text-zinc-600 sm:block dark:text-violet-100/80">
                  {subtitle}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
