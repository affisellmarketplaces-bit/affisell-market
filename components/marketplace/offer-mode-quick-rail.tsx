"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Package, Recycle, RefreshCw } from "lucide-react"

import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { offerFacetSlug, offerModeBadge, type ProductOfferMode } from "@/lib/product-offer-mode"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
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

  const toggle = (slug: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (activeOffer === slug) next.delete(MARKETPLACE_OFFER_FACET_KEY)
    else next.set(MARKETPLACE_OFFER_FACET_KEY, slug)
    const qs = next.toString()
    router.push(`${basePath ?? pathname}${qs ? `?${qs}` : ""}`)
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/90 via-white to-teal-50/80 p-3 shadow-sm dark:border-violet-900/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-teal-950/20",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_50%,rgba(139,92,246,0.12),transparent)]" />
      <div className="relative flex flex-wrap items-center gap-2">
        <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700/80 dark:text-violet-300/80">
          {t("eyebrow")}
        </p>
        {RAIL_MODES.map((mode) => {
          const slug = offerFacetSlug(mode)
          const badge = offerModeBadge(mode, resolveBinaryCopyLocale(locale))
          if (!slug || !badge) return null
          const Icon = RAIL_ICONS[mode as keyof typeof RAIL_ICONS]
          const active = activeOffer === slug
          return (
            <button
              key={mode}
              type="button"
              onClick={() => toggle(slug)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/25"
                  : "border-white/80 bg-white/70 text-zinc-700 hover:border-violet-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-violet-700"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {badge.shortLabel}
            </button>
          )
        })}
        {activeOffer ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString())
              next.delete(MARKETPLACE_OFFER_FACET_KEY)
              const qs = next.toString()
              router.push(`${basePath ?? pathname}${qs ? `?${qs}` : ""}`)
            }}
            className="ml-auto text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            {t("clear")}
          </button>
        ) : null}
      </div>
    </div>
  )
}
