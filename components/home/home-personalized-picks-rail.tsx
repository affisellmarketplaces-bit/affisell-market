"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { ProductCard } from "@/components/ProductCard"
import { buyerListingToCardProps } from "@/lib/buyer-discovery-types"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { cn } from "@/lib/utils"

type Props = {
  picks: BuyerPersonalizedPicksPayload
  className?: string
}

export function HomePersonalizedPicksRail({ picks, className }: Props) {
  const t = useTranslations("marketplace.browse.personalized")

  if (picks.items.length < 4) return null

  const personalized = picks.personalized

  return (
    <section
      aria-labelledby="personalized-picks-heading"
      className={cn(
        "relative mb-4 overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/50 p-3 shadow-sm sm:mb-5 sm:rounded-3xl sm:p-4 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl"
        aria-hidden
      />
      <div className="relative mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
            {personalized ? t("eyebrowForYou") : t("eyebrowTrending")}
          </p>
          <h2
            id="personalized-picks-heading"
            className="mt-0.5 text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg"
          >
            {personalized ? t("titleForYou") : t("titleTrending")}
          </h2>
          <p className="mt-1 max-w-xl text-[11px] leading-snug text-zinc-600 dark:text-zinc-400 sm:text-xs">
            {personalized ? t("hintForYou") : t("hintTrending")}
          </p>
        </div>
        <Link
          href="/discover"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-violet-800 shadow-sm transition hover:border-violet-300 hover:bg-white dark:border-violet-800 dark:bg-zinc-950/70 dark:text-violet-200 sm:text-[11px]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("pulseCta")}
        </Link>
      </div>

      <ul className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {picks.items.map((item) => (
          <li
            key={item.listingId}
            className="w-[11.5rem] shrink-0 snap-start sm:w-[12.75rem]"
          >
            <ProductCard product={buyerListingToCardProps(item)} mode="customer" />
          </li>
        ))}
      </ul>
    </section>
  )
}
