"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Package, Recycle, RefreshCw, Sparkles, X } from "lucide-react"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
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
}

export function OfferModeQuickRail({ basePath, className }: Props) {
  const t = useTranslations("marketplace.browse.offerRail")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const activeOffer = searchParams.get(MARKETPLACE_OFFER_FACET_KEY)
  const targetPath = basePath ?? pathname

  const pushParams = (next: URLSearchParams) => {
    const qs = next.toString()
    router.push(`${targetPath}${qs ? `?${qs}` : ""}`)
  }

  const toggle = (slug: string) => {
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
          <span className="relative flex size-2 shrink-0" aria-hidden>
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
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-brand-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand backdrop-blur-sm transition hover:border-brand/35 hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand/35 dark:bg-brand-muted/30 dark:text-brand-light"
          >
            <X className="size-3 shrink-0 opacity-70" aria-hidden />
            {t("clear")}
          </button>
        ) : (
          <span className="ml-auto hidden items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:inline-flex dark:text-zinc-400">
            <Sparkles className="size-3 shrink-0 text-brand dark:text-brand-light" aria-hidden />
            {t("tapHint")}
          </span>
        )}
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2.5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {RAIL_MODES.map((mode) => {
          const slug = offerFacetSlug(mode)
          const badge = offerModeFilterLabel(mode, locale as AppLocale)
          if (!slug || !badge) return null
          const Icon = RAIL_ICONS[mode as keyof typeof RAIL_ICONS]
          const active = activeOffer === slug
          return (
            <button
              key={mode}
              type="button"
              data-mode={slug as OfferModeSlug}
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              onClick={() => toggle(slug)}
              className="affisell-offer-mode-card group relative flex min-h-[3.25rem] min-w-[6.75rem] flex-1 shrink-0 items-center gap-2 overflow-hidden rounded-2xl px-2.5 py-2 text-left transition duration-300 hover:-translate-y-0.5 active:scale-[0.99] sm:min-h-[3.5rem] sm:min-w-0 sm:px-3"
            >
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
                <span className="mt-0.5 hidden truncate text-[10px] leading-snug text-zinc-600 lg:block dark:text-violet-100/80">
                  {badge.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
