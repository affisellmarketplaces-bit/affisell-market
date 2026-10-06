"use client"

import { ArrowDown, RotateCcw, TrendingUp, Truck } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"

import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import { accessibleButtonColors } from "@/lib/storefront/accessible-button-colors"
import { HERO_MIN_SALES_PROOF, type HeroStats } from "@/lib/storefront/storefront-hero-stats"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  nameBadge?: StoreNameBadgeStyle
  accent: string
  primary: string
  align: "left" | "center" | "right"
  /** A short pitch (first sentence of the description). Omitted when the story section already carries the text. */
  tagline: string | null
  stats: HeroStats
  /** The merchant switched the store name off for this hero: keep a screen-reader heading, show no visible title. */
  showName: boolean
  /** `null` when the store has no section to scroll to — the button is then omitted rather than left dead. */
  productsHref: string | null
  bestsellersHref: string | null
}

const rise = (delayMs: number) => ({ "--hero-delay": `${delayMs}ms` }) as CSSProperties

/**
 * The part of the hero that says WHO the store is — until now the hero was a bare image / video / gradient with no words.
 * Sized with container queries (not viewport breakpoints) so it is right on the live page and inside the Brand Studio's
 * narrow phone preview alike. Every claim comes from real store data (`HeroStats`); nothing is shown that is not true.
 */
export function StorefrontHeroIdentity({
  storeName,
  nameBadge = "parallelogram",
  accent,
  primary,
  align,
  tagline,
  stats,
  showName,
  productsHref,
  bestsellersHref,
}: Props) {
  const t = useTranslations("storefront.hero")
  const name = storeName.trim()
  const centered = align === "center"
  const button = accessibleButtonColors(accent)

  const chips: {
    key: string
    icon?: typeof Truck
    label: string
    klarna?: boolean
  }[] = []
  if (stats.topSales >= HERO_MIN_SALES_PROOF) {
    chips.push({
      key: "sales",
      icon: TrendingUp,
      label: t("chipSales", { count: stats.topSales }),
    })
  }
  if (stats.freeShippingCount > 0) chips.push({ key: "ship", icon: Truck, label: t("chipFreeShipping") })
  chips.push({ key: "returns", icon: RotateCcw, label: t("chipReturns") })
  if (stats.klarnaEligible) chips.push({ key: "klarna", label: t("chipKlarna"), klarna: true })

  return (
    <div
      className={cn(
        "relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-end gap-3 self-stretch px-4 py-6",
        "@[34rem]:gap-4 @[34rem]:px-6 @[34rem]:py-10",
        centered ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left"
      )}
    >
      {stats.productCount > 0 ? (
        <p
          style={rise(0)}
          className="affisell-hero-rise inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md"
        >
          <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {t("eyebrow", { count: stats.productCount })}
        </p>
      ) : null}

      {showName && name ? (
        <div style={rise(70)} className="affisell-hero-rise max-w-full">
          <StoreNameBadge name={name} style={nameBadge} accent={accent} primary={primary} size="hero" />
        </div>
      ) : (
        <h1 className="sr-only">{name}</h1>
      )}

      {tagline ? (
        <p
          style={rise(140)}
          className="affisell-hero-rise max-w-xl text-sm font-medium leading-relaxed text-white/90 drop-shadow-sm @[34rem]:text-lg"
        >
          {tagline}
        </p>
      ) : null}

      {productsHref || bestsellersHref ? (
        <div style={rise(210)} className={cn("affisell-hero-rise flex flex-wrap gap-2", centered && "justify-center")}>
          {productsHref ? (
            <a
              href={productsHref}
              className="group inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-lg shadow-black/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 active:scale-95"
              style={{ backgroundColor: button.bg, color: button.fg }}
            >
              {t("ctaShop")}
              <ArrowDown className="size-4 transition group-hover:translate-y-0.5" aria-hidden />
            </a>
          ) : null}
          {bestsellersHref ? (
            <a
              href={bestsellersHref}
              className="inline-flex h-11 items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95"
            >
              {t("ctaBestsellers")}
            </a>
          ) : null}
        </div>
      ) : null}

      <ul style={rise(280)} className={cn("affisell-hero-rise flex flex-wrap gap-1.5", centered && "justify-center")}>
        {chips.slice(0, 4).map((c) => (
          <li
            key={c.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              c.klarna
                ? "bg-[#FFB3C7] text-neutral-950"
                : "border border-white/20 bg-black/25 text-white/95 backdrop-blur-md"
            )}
          >
            {c.icon ? <c.icon className="size-3.5 shrink-0" aria-hidden /> : null}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
