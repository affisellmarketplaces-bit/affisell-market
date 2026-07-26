"use client"

import { TrendingDown } from "lucide-react"
import { useTranslations } from "next-intl"

import { formatStoreCurrency } from "@/lib/market-config"
import { isDonationListing, parseProductOfferMode } from "@/lib/product-offer-mode"
import { resolveProductDiscount } from "@/lib/product-discount-display"
import { cn } from "@/lib/utils"

type Layout = "card" | "detail" | "compact"

type Props = {
  price: number
  compareAt?: number | string | null
  layout?: Layout
  align?: "start" | "end"
  className?: string
  offerMode?: string
  /** Pulse Battle flash % — shows strikethrough list price + flash price. */
  flashPercent?: number | null
}

export function ProductPriceOffer({
  price,
  compareAt,
  layout = "card",
  align = "start",
  className,
  offerMode,
  flashPercent = null,
}: Props) {
  const t = useTranslations("product.discount")
  const tOffer = useTranslations("product.offer")
  const mode = parseProductOfferMode(offerMode)

  const flashPct =
    typeof flashPercent === "number" &&
    Number.isFinite(flashPercent) &&
    flashPercent > 0 &&
    flashPercent < 90
      ? Math.round(flashPercent)
      : null
  const flashPrice =
    flashPct != null ? Math.round(price * (1 - flashPct / 100) * 100) / 100 : null

  if (isDonationListing(mode, Math.round(price * 100))) {
    return (
      <span
        className={cn(
          "font-black tracking-tight text-emerald-600 dark:text-emerald-400",
          layout === "detail" ? "text-3xl" : layout === "compact" ? "text-lg" : "text-xl",
          className
        )}
      >
        {tOffer("free")}
      </span>
    )
  }

  if (flashPct != null && flashPrice != null) {
    return (
      <div className={cn("space-y-1", align === "end" && "text-right", className)}>
        <div className={cn("flex flex-wrap items-center gap-2", align === "end" && "justify-end")}>
          <span
            className={cn(
              "tabular-nums font-black tracking-tight text-red-600 dark:text-red-400",
              layout === "detail" ? "text-3xl" : "text-xl"
            )}
          >
            {formatStoreCurrency(flashPrice)}
          </span>
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white animate-pulse">
            −{flashPct}% BATTLE
          </span>
        </div>
        <span className="text-sm tabular-nums text-zinc-400 line-through">
          {formatStoreCurrency(price)}
        </span>
      </div>
    )
  }

  const offer = resolveProductDiscount(price, compareAt)

  if (!offer) {
    return (
      <span
        className={cn(
          "font-black tabular-nums tracking-tight text-zinc-900 transition-transform duration-200 dark:text-white",
          layout === "detail" ? "text-3xl" : layout === "compact" ? "text-lg" : "text-[1.125rem] leading-none md:text-[1.7rem]",
          className
        )}
      >
        {formatStoreCurrency(price)}
      </span>
    )
  }

  const priceClass =
    layout === "detail"
      ? "text-3xl font-bold tracking-tight"
      : layout === "compact"
        ? "text-lg font-bold"
        : "text-[1.125rem] font-black leading-none tracking-[-0.03em] md:text-[1.7rem]"

  return (
    <div className={cn("space-y-1", align === "end" && "text-right", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          align === "end" && "justify-end"
        )}
      >
        <span className={cn("tabular-nums text-zinc-950 transition-transform duration-200 dark:text-white", priceClass)}>
          {formatStoreCurrency(offer.price)}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full font-bold tabular-nums tracking-tight",
            "bg-gradient-to-r from-rose-500/95 via-fuchsia-500/95 to-violet-500/95 text-white shadow-[0_8px_18px_-8px_rgba(244,63,94,0.65)]",
            "ring-1 ring-inset ring-white/35",
            layout === "detail" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"
          )}
        >
          −{offer.percent}%
        </span>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
          align === "end" && "justify-end"
        )}
      >
        <span
          className={cn(
            "tabular-nums text-zinc-400 line-through decoration-zinc-300/90 dark:text-zinc-500 dark:decoration-zinc-600",
            layout === "detail" ? "text-sm" : "text-xs"
          )}
        >
          {formatStoreCurrency(offer.compareAt)}
        </span>
        <span
          className={cn(
            "hidden items-center gap-1 font-semibold text-emerald-700 md:inline-flex dark:text-emerald-400",
            layout === "detail" ? "text-sm" : "text-[11px]"
          )}
        >
          <TrendingDown className="size-3 shrink-0 opacity-80" aria-hidden />
          {t("save", { amount: formatStoreCurrency(offer.savingsAmount) })}
        </span>
      </div>
    </div>
  )
}
