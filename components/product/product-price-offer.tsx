"use client"

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
}

export function ProductPriceOffer({
  price,
  compareAt,
  layout = "card",
  align = "start",
  className,
  offerMode,
}: Props) {
  const t = useTranslations("product.discount")
  const tOffer = useTranslations("product.offer")
  const mode = parseProductOfferMode(offerMode)
  const offer = resolveProductDiscount(price, compareAt)

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

  if (!offer) {
    return (
      <span
        className={cn(
          "font-black tabular-nums tracking-tight text-zinc-900 dark:text-white",
          layout === "detail" ? "text-3xl" : layout === "compact" ? "text-lg" : "text-xl",
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
        : "text-xl font-black"

  return (
    <div className={cn("space-y-1", align === "end" && "text-right", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          align === "end" && "justify-end"
        )}
      >
        <span className={cn("tabular-nums text-zinc-900 dark:text-white", priceClass)}>
          {formatStoreCurrency(offer.price)}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full font-bold tabular-nums tracking-tight",
            "bg-gradient-to-r from-rose-600 via-rose-500 to-violet-600 text-white shadow-sm shadow-rose-500/20",
            "ring-1 ring-inset ring-white/25",
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
            "font-semibold text-emerald-700 dark:text-emerald-400",
            layout === "detail" ? "text-sm" : "text-[11px]"
          )}
        >
          {t("save", { amount: formatStoreCurrency(offer.savingsAmount) })}
        </span>
      </div>
    </div>
  )
}
