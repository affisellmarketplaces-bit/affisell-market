"use client"

import { Flame, TrendingUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  shouldShowProductCrossSocialProof,
  type ProductSocialProofData,
} from "@/lib/product-social-proof-shared"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  data: ProductSocialProofData | null | undefined
  className?: string
}

/** One-line FOMO for Discover / catalog cards. */
export function ProductCrossSocialProofCompact({ data, className }: Props) {
  const t = useTranslations("Product.crossSocialProof")
  const locale = useLocale()

  if (!data || !shouldShowProductCrossSocialProof(data)) return null
  if (data.activeResellersCount < 2 && !data.lastSaleAt) return null

  const hot = data.activeResellersCount >= 5

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-violet-200/70 bg-violet-50/80 px-2.5 py-1.5 text-[10px] font-semibold leading-snug text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/35 dark:text-violet-100",
        hot && "border-amber-300/70 bg-amber-50/85 text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
      data-testid="discover-social-proof-compact"
    >
      {hot ? <Flame className="size-3 shrink-0" aria-hidden /> : null}
      <span>{t("activeResellers", { count: data.activeResellersCount })}</span>
      {data.topMarginCents > 0 ? (
        <span className="inline-flex items-center gap-0.5 tabular-nums opacity-90">
          <TrendingUp className="size-2.5" aria-hidden />
          {t("topMargin", { amount: formatStoreCurrencyFromCents(data.topMarginCents) })}
        </span>
      ) : null}
      {data.lastSaleAt && locale === "fr" && data.lastSaleResellerLabel ? (
        <span className="w-full font-medium text-violet-800/90 dark:text-violet-200/90">
          {t("lastSaleShort", { name: data.lastSaleResellerLabel })}
        </span>
      ) : null}
    </p>
  )
}
