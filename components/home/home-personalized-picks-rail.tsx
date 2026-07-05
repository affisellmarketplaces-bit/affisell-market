"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { ProductCard } from "@/components/ProductCard"
import { buyerListingToCardProps } from "@/lib/buyer-discovery-types"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { brandOrbitRailEyebrow, brandOrbitRailGlow, brandOrbitRailShell } from "@/lib/affisell-brand-orbit-shared"
import { cn } from "@/lib/utils"

type Props = {
  picks: BuyerPersonalizedPicksPayload
  className?: string
  variant?: "default" | "compact" | "pulse"
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
      className={cn(
        brandOrbitRailShell,
        pulse
          ? "mb-2 max-h-[5.25rem] overflow-hidden p-2"
          : compact
            ? "mb-3 p-2.5 sm:p-3"
            : "mb-4 p-3 sm:mb-5 sm:rounded-3xl sm:p-4",
        className
      )}
    >
      <div className={brandOrbitRailGlow} aria-hidden />
      <div
        className={cn(
          "relative flex flex-wrap items-center justify-between gap-2",
          pulse ? "mb-1.5" : "mb-3 items-end"
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300",
              pulse ? "text-[8px]" : compact ? "text-[9px]" : "text-[10px]"
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
          pulse && "gap-2 pb-0"
        )}
      >
        {picks.items.map((item) => (
          <li
            key={item.listingId}
            className={cn(
              "shrink-0 snap-start",
              pulse
                ? "w-[4.75rem]"
                : compact
                  ? "w-[10.25rem] sm:w-[11rem]"
                  : "w-[11.5rem] sm:w-[12.75rem]"
            )}
          >
            <ProductCard product={buyerListingToCardProps(item)} mode="customer" />
          </li>
        ))}
      </ul>
    </section>
  )
}
