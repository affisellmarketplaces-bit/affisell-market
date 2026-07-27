"use client"

import Link from "next/link"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { resolvePulseItemDetailHref } from "@/lib/pulse-item-detail-href"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

type PulseProductDetailPanelProps = {
  item: PulseFeedItem
  priceEur: number
  compareEur: number | null
  /** Compact overlay on mobile swipe ribbon vs full desktop side panel */
  variant: "ribbon" | "desktop"
  className?: string
}

export function PulseProductDetailPanel({
  item,
  priceEur,
  compareEur,
  variant,
  className = "",
}: PulseProductDetailPanelProps) {
  const t = useTranslations("pulse.commerce")
  const detailHref = resolvePulseItemDetailHref(item)

  const titleClass =
    variant === "desktop"
      ? "text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl"
      : "line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow-sm sm:text-[15px] sm:leading-snug"

  return (
    <div className={className} data-testid="pulse-product-detail-panel">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {item.boosted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/25 px-1.5 py-px text-[9px] font-bold uppercase text-cyan-100 ring-1 ring-cyan-400/35 backdrop-blur-sm sm:px-2 sm:py-0.5 sm:text-[10px]">
            <Sparkles className="size-2.5 sm:size-3" aria-hidden />
            {t("hotBadge")}
          </span>
        ) : null}
        {item.soldCount > 0 ? (
          <ProductSalesBadge
            count={item.soldCount}
            variant="inline"
            className="!bg-black/35 !text-white !ring-white/20 backdrop-blur-sm"
          />
        ) : null}
      </div>

      <Link
        href={detailHref}
        prefetch
        className={cn(
          "group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80",
          variant === "ribbon" ? "mt-1 sm:mt-1.5" : "mt-3"
        )}
        data-testid="pulse-product-title-link"
      >
        <h2
          className={cn(
            titleClass,
            "transition-colors group-hover:text-violet-200 group-focus-visible:text-violet-200"
          )}
        >
          {item.title}
          {variant === "desktop" ? (
            <ArrowUpRight
              className="ml-1.5 inline-block size-4 translate-y-[-1px] opacity-60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 sm:size-5"
              aria-hidden
            />
          ) : null}
        </h2>
      </Link>

      {variant === "desktop" && item.caption?.trim() ? (
        <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/65">{item.caption}</p>
      ) : null}

      {priceEur > 0 ? (
        <div
          className={cn(
            variant === "ribbon"
              ? "mt-0.5 [&_p]:!text-white/75 [&_span]:!text-white sm:mt-1"
              : "mt-4 [&_span]:!text-white [&_p]:!text-white/70"
          )}
        >
          <ProductPriceOffer
            price={priceEur}
            compareAt={compareEur}
            layout={variant === "desktop" ? "detail" : "compact"}
          />
        </div>
      ) : null}

      {item.storeName ? (
        <p
          className={cn(
            "truncate text-white/55",
            variant === "ribbon"
              ? "mt-0.5 text-[10px] sm:mt-1 sm:text-xs sm:text-zinc-300"
              : "mt-3 text-sm text-white/60"
          )}
        >
          {item.storeName}
        </p>
      ) : null}

      {variant === "desktop" ? (
        <Link
          href={detailHref}
          prefetch
          className={cn(
            affisellBrand.epoxyCta,
            "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-violet-100"
          )}
          data-testid="pulse-view-details-cta"
        >
          {t("viewDetails")}
          <ArrowUpRight className="size-4 shrink-0 opacity-80" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
