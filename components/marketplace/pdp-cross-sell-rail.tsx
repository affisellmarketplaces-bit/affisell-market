"use client"

import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import type { PdpCrossSellCard } from "@/lib/marketplace-pdp-cross-sell-shared"
import { formatStoreCurrency } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  items: PdpCrossSellCard[]
  kind: "boughtTogether" | "alsoViewed"
  variant?: "default" | "compact"
  className?: string
}

export function PdpCrossSellRail({
  items,
  kind,
  variant = "default",
  className,
}: Props) {
  const t = useTranslations("marketplace.pdp.crossSell")

  if (items.length === 0) return null

  const compact = variant === "compact"

  return (
    <section
      data-testid={`pdp-cross-sell-${kind}`}
      className={cn(compact ? "mt-4" : "mt-10", className)}
      aria-labelledby={`pdp-cross-sell-${kind}-heading`}
    >
      <div className={cn("flex flex-wrap items-end justify-between gap-2", compact ? "mb-2" : "mb-4")}>
        <div>
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300",
              compact ? "text-[9px]" : "text-[10px]"
            )}
          >
            {kind === "boughtTogether" ? t("eyebrowBoughtTogether") : t("eyebrowAlsoViewed")}
          </p>
          <h2
            id={`pdp-cross-sell-${kind}-heading`}
            className={cn(
              "font-bold tracking-tight text-zinc-900 dark:text-white",
              compact ? "text-sm" : "text-xl"
            )}
          >
            {kind === "boughtTogether" ? t("titleBoughtTogether") : t("titleAlsoViewed")}
          </h2>
        </div>
      </div>

      <ul
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !compact && "sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
        )}
      >
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "shrink-0 snap-start",
              compact ? "w-[9.5rem]" : "w-[11rem] sm:w-auto"
            )}
          >
            <FastLink
              href={item.href}
              className="group block rounded-xl border border-zinc-200/90 bg-white/90 p-2.5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-violet-800/60"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {item.soldCount ? (
                  <ProductSalesBadge count={item.soldCount} variant="overlay" />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {item.title}
              </p>
              <p className="mt-1 text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                {formatStoreCurrency(item.priceEur)}
              </p>
            </FastLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
