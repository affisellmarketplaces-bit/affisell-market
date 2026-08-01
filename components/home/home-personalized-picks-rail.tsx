"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { ProductCard } from "@/components/ProductCard"
import {
  isDisplayableListingImageUrl,
  PRODUCT_CARD_IMAGE_FALLBACK,
} from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { buyerListingToCardProps, type BuyerListingCard } from "@/lib/buyer-discovery-types"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { brandOrbitRailEyebrow, brandOrbitRailGlow, brandOrbitRailShell } from "@/lib/affisell-brand-orbit-shared"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  picks: BuyerPersonalizedPicksPayload
  className?: string
  variant?: "default" | "compact" | "pulse"
}

/** Pulse chrome beacon — fits ~4.5–5.5rem height strip (no full ProductCard). */
function PulsePickBeacon({ item }: { item: BuyerListingCard }) {
  const href = shopListingPath(item.storeSlug, item.listingId, item.customSlug)
  const raw = item.imageUrl?.trim() ?? ""
  const imageSrc = isDisplayableListingImageUrl(raw) ? raw : PRODUCT_CARD_IMAGE_FALLBACK
  const price = formatStoreCurrencyFromCents(item.priceCents)

  return (
    <Link
      href={href}
      title={item.name}
      aria-label={`${item.name} — ${price}`}
      data-testid="pulse-for-you-beacon"
      className={cn(
        "group relative flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-0.5 py-0.5",
        "transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14]"
      )}
    >
      <span
        className={cn(
          "relative size-10 overflow-hidden rounded-full sm:size-11",
          "ring-2 ring-cyan-300/35 ring-offset-1 ring-offset-[#070b14]",
          "shadow-[0_0_18px_rgb(34_211_238_/_0.22)]",
          "transition group-hover:ring-cyan-300/60 group-hover:shadow-[0_0_24px_rgb(34_211_238_/_0.35)]"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- merchant CDN URLs; same as ProductCard */}
        <img src={imageSrc} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-black/35 via-transparent to-cyan-300/10"
          aria-hidden
        />
      </span>
      <span className="max-w-full truncate px-0.5 text-center text-[10px] font-bold tabular-nums tracking-tight text-cyan-50/95 sm:text-[11px]">
        {price}
      </span>
    </Link>
  )
}

export function HomePersonalizedPicksRail({ picks, className, variant = "default" }: Props) {
  const t = useTranslations("marketplace.browse.personalized")

  if (picks.items.length < 4) return null

  const personalized = picks.personalized
  const compact = variant === "compact"
  const pulse = variant === "pulse"

  return (
    <section
      aria-labelledby="personalized-picks-heading"
      data-testid={pulse ? "pulse-for-you-rail" : "personalized-picks-rail"}
      className={cn(
        pulse
          ? cn(
              "relative mb-0 overflow-hidden rounded-2xl border border-cyan-400/20",
              "bg-gradient-to-r from-[#070b14]/92 via-[#0a1424]/88 to-[#071018]/92",
              "p-1.5 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.12)] sm:mb-1 sm:p-2"
            )
          : cn(
              brandOrbitRailShell,
              compact ? "mb-3 p-2.5 sm:p-3" : "mb-4 p-3 sm:mb-5 sm:rounded-3xl sm:p-4"
            ),
        className
      )}
    >
      <div
        className={cn(brandOrbitRailGlow, pulse && "bg-[radial-gradient(ellipse_80%_50%_at_0%_50%,rgba(34,211,238,0.12),transparent)]")}
        aria-hidden
      />
      <div
        className={cn(
          "relative flex flex-wrap items-center justify-between gap-2",
          pulse ? "mb-1" : "mb-3 items-end"
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.18em]",
              pulse
                ? "text-[8px] text-cyan-300/90"
                : compact
                  ? "text-[9px] text-violet-600 dark:text-violet-300"
                  : brandOrbitRailEyebrow
            )}
          >
            {personalized ? t("eyebrowForYou") : t("eyebrowTrending")}
          </p>
          {!pulse ? (
            <h2
              id="personalized-picks-heading"
              className={cn(
                "mt-0.5 font-bold tracking-tight text-zinc-900 dark:text-white",
                compact ? "text-sm" : "text-base sm:text-lg"
              )}
            >
              {personalized ? t("titleForYou") : t("titleTrending")}
            </h2>
          ) : (
            <h2 id="personalized-picks-heading" className="sr-only">
              {personalized ? t("titleForYou") : t("titleTrending")}
            </h2>
          )}
          {!compact && !pulse ? (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-zinc-600 dark:text-zinc-400 sm:text-xs">
              {personalized ? t("hintForYou") : t("hintTrending")}
            </p>
          ) : null}
        </div>
        {!pulse ? (
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-violet-800 shadow-sm transition hover:border-violet-300 hover:bg-white dark:border-violet-800 dark:bg-zinc-950/70 dark:text-violet-200 sm:text-[11px]"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("pulseCta")}
          </Link>
        ) : null}
      </div>

      <ul
        className={cn(
          "relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact && "gap-2.5",
          pulse &&
            "affisell-pulse-for-you-track gap-2.5 overflow-x-auto overflow-y-visible pb-0 [-webkit-overflow-scrolling:touch]"
        )}
      >
        {picks.items.map((item) =>
          pulse ? (
            <li key={item.listingId} className="shrink-0 snap-start">
              <PulsePickBeacon item={item} />
            </li>
          ) : (
            <li
              key={item.listingId}
              className={cn(
                "shrink-0 snap-start",
                compact ? "w-[10.25rem] sm:w-[11rem]" : "w-[11.5rem] sm:w-[12.75rem]"
              )}
            >
              <ProductCard product={buyerListingToCardProps(item)} mode="customer" />
            </li>
          )
        )}
      </ul>
    </section>
  )
}
