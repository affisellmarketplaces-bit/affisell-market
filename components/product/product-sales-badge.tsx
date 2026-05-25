"use client"

import { ShoppingBag, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  formatSalesCountCompact,
  isPopularSalesCount,
  normalizeListingSalesCount,
  shouldShowBuyerSalesCount,
} from "@/lib/listing-sales-count"
import { cn } from "@/lib/utils"

type Variant = "overlay" | "inline" | "detail"

type Props = {
  count: number
  variant?: Variant
  className?: string
}

export function ProductSalesBadge({ count, variant = "overlay", className }: Props) {
  const t = useTranslations("product.sales")
  const locale = useLocale()
  const n = normalizeListingSalesCount(count)

  if (!shouldShowBuyerSalesCount(n)) return null

  const popular = isPopularSalesCount(n)
  const compact = formatSalesCountCompact(n, locale)
  const label = popular ? t("popular", { compact }) : t("count", { count: n })

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-2.5 py-1 text-[11px] font-semibold text-violet-950 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100",
          className
        )}
      >
        <ShoppingBag className="size-3 shrink-0 opacity-80" aria-hidden />
        {label}
      </span>
    )
  }

  if (variant === "detail") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/95 via-white/90 to-fuchsia-50/80 px-3.5 py-2 shadow-sm shadow-violet-500/10 dark:border-violet-800/50 dark:from-violet-950/60 dark:via-zinc-950/80 dark:to-fuchsia-950/40",
          popular && "border-amber-300/70 from-amber-50/90 via-white/90 to-violet-50/80 dark:border-amber-800/50 dark:from-amber-950/50",
          className
        )}
        role="status"
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
            popular && "bg-amber-500/15 text-amber-800 dark:text-amber-200"
          )}
          aria-hidden
        >
          {popular ? <Sparkles className="size-4" /> : <ShoppingBag className="size-4" />}
        </span>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600/90 dark:text-violet-300">
            {popular ? t("eyebrowPopular") : t("eyebrowSold")}
          </p>
          <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{label}</p>
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        "pointer-events-none absolute left-2.5 top-2.5 z-[15] inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1 rounded-full border border-white/40 bg-zinc-900/75 px-2 py-1 text-[10px] font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-md",
        popular &&
          "border-amber-200/50 bg-gradient-to-r from-amber-600/90 to-violet-700/90",
        className
      )}
      role="status"
    >
      {popular ? (
        <Sparkles className="size-3 shrink-0 text-amber-100" aria-hidden />
      ) : (
        <ShoppingBag className="size-3 shrink-0 opacity-90" aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}
