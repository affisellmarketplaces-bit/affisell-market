"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Package, Recycle, RefreshCw, Sparkles, X } from "lucide-react"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
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

const ICON_ACCENT = BUYER_TILE_ACCENTS.catalog.icon

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
        <p className="hidden text-[11px] font-medium text-zinc-600 sm:inline dark:text-zinc-400">{t("hint")}</p>
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

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
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
              className="affisell-offer-mode-card group relative flex min-h-[4.25rem] items-center gap-2.5 overflow-hidden rounded-2xl p-3 text-left transition duration-300 hover:-translate-y-0.5 active:scale-[0.99] sm:min-h-[5rem] sm:flex-col sm:items-start sm:justify-between sm:p-4"
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
                  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner sm:h-9 sm:w-9",
                  ICON_ACCENT
                )}
              >
                <Icon className="size-3.5 text-white sm:size-4" aria-hidden />
              </span>
              <span className="relative min-w-0 flex-1 sm:mt-2 sm:w-full sm:flex-none">
                <span className="block truncate text-xs font-bold leading-snug text-zinc-900 sm:text-sm dark:text-white">
                  {badge.shortLabel}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-zinc-600 sm:line-clamp-none sm:text-[11px] dark:text-violet-100/80">
                  {badge.label}
                </span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-brand/70 dark:text-brand-light/80">
                  {t("cardSupplierNote")}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
