"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Package, Recycle, RefreshCw, Sparkles, X } from "lucide-react"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { offerFacetSlug, offerModeBadge, type ProductOfferMode } from "@/lib/product-offer-mode"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

const RAIL_MODES: ProductOfferMode[] = [
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
]

const RAIL_ICONS = {
  REFURBISHED: Recycle,
  SECOND_HAND: RefreshCw,
  WHOLESALE_ONLY: Package,
  DONATION: Gift,
} as const

type OfferModeSlug = "refurbished" | "second_hand" | "wholesale" | "donation"

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
    if (activeOffer === slug) next.delete(MARKETPLACE_OFFER_FACET_KEY)
    else next.set(MARKETPLACE_OFFER_FACET_KEY, slug)
    pushParams(next)
  }

  const clear = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete(MARKETPLACE_OFFER_FACET_KEY)
    pushParams(next)
  }

  return (
    <section
      className={cn(
        "affisell-offer-mode-rail epoxy-surface--light relative overflow-hidden rounded-2xl p-3 sm:p-4",
        className
      )}
      aria-label={t("eyebrow")}
    >
      <div className="affisell-offer-mode-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
      <div
        className="pointer-events-none absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 top-0 h-20 w-28 rounded-full bg-teal-400/10 blur-2xl dark:bg-teal-500/10"
        aria-hidden
      />

      <div className="relative mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400/60 opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.55)]" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-800 dark:text-violet-200">
            {t("eyebrow")}
          </p>
        </div>
        <p className="hidden text-[11px] font-medium text-violet-900/55 sm:inline dark:text-violet-200/55">
          {t("hint")}
        </p>
        {activeOffer ? (
          <button
            type="button"
            onClick={clear}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-violet-300/50 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-800 backdrop-blur-sm transition hover:border-violet-400 hover:bg-white dark:border-violet-700/50 dark:bg-zinc-900/70 dark:text-violet-200 dark:hover:border-violet-500"
          >
            <X className="size-3 shrink-0 opacity-70" aria-hidden />
            {t("clear")}
          </button>
        ) : (
          <span className="ml-auto hidden items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-violet-700/45 sm:inline-flex dark:text-violet-300/45">
            <Sparkles className="size-3 shrink-0" aria-hidden />
            {t("tapHint")}
          </span>
        )}
      </div>

      <div className="relative flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {RAIL_MODES.map((mode) => {
          const slug = offerFacetSlug(mode)
          const badge = offerModeBadge(mode, locale as AppLocale)
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
              className="affisell-offer-mode-chip group inline-flex shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-[transform,box-shadow,border-color,background] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 sm:rounded-2xl sm:px-3.5 sm:py-2.5"
            >
              <span className="affisell-offer-mode-chip__icon inline-flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8 sm:rounded-xl">
                <Icon className="size-3.5 sm:size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="affisell-offer-mode-chip__label truncate">{badge.shortLabel}</span>
                <span className="affisell-offer-mode-chip__meta hidden text-[10px] font-medium opacity-70 sm:block">
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
