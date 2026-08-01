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
  const ribbon = variant === "ribbon"

  const titleClass = ribbon
    ? "line-clamp-2 text-[13px] font-semibold leading-snug tracking-[-0.01em] text-white drop-shadow-[0_1px_12px_rgb(0_0_0_/_0.45)] sm:text-[15px]"
    : "text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl"

  return (
    <div
      className={cn(ribbon && "pulse-product-ribbon", className)}
      data-testid="pulse-product-detail-panel"
    >
      <div className={cn("flex flex-wrap items-center gap-1.5", ribbon ? "gap-1" : "sm:gap-2")}>
        {item.boosted ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.14em] text-cyan-50 ring-1 backdrop-blur-md",
              ribbon
                ? "bg-cyan-400/20 px-1.5 py-px text-[8px] ring-cyan-300/40"
                : "bg-cyan-500/25 px-2 py-0.5 text-[10px] ring-cyan-400/35"
            )}
          >
            <Sparkles className={cn(ribbon ? "size-2.5" : "size-3")} aria-hidden />
            {t("hotBadge")}
          </span>
        ) : null}
        {item.soldCount > 0 ? (
          <ProductSalesBadge
            count={item.soldCount}
            variant="inline"
            className="!bg-black/40 !text-white/90 !ring-white/15 backdrop-blur-md"
          />
        ) : null}
      </div>

      <Link
        href={detailHref}
        prefetch
        className={cn(
          "group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
          ribbon ? "mt-1 sm:mt-1.5" : "mt-3"
        )}
        data-testid="pulse-product-title-link"
      >
        <h2
          className={cn(
            titleClass,
            "transition-colors group-hover:text-cyan-100 group-focus-visible:text-cyan-100"
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
            ribbon
              ? "pulse-product-ribbon__price mt-1.5 [&_p]:!text-cyan-100/70 [&_span]:!text-white sm:mt-2"
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
            "truncate font-medium tracking-wide text-white/45",
            ribbon ? "mt-1 text-[10px] sm:text-[11px]" : "mt-3 text-sm text-white/55"
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
            "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-cyan-400/35 hover:bg-cyan-500/10 hover:text-cyan-50"
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
