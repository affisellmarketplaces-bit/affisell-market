"use client"

import { motion } from "framer-motion"
import { Flame, TrendingUp, Zap } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  formatLastSaleAgoLine,
  formatMarginLeaveEurFromCents,
  formatMarginTopEurFromCents,
  resolveMarginLeaveOnTableTrigger,
  shouldShowProductCrossSocialProof,
  type ProductSocialProofData,
} from "@/lib/product-social-proof-shared"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import { cn } from "@/lib/utils"

type Props = {
  data: ProductSocialProofData | null | undefined
  /** Affiliate eval / Discover — sharper FOMO copy. */
  variant?: "affiliate" | "storefront"
  className?: string
  dense?: boolean
}

export function ProductCrossSocialProof({
  data,
  variant = "storefront",
  className,
  dense = false,
}: Props) {
  const t = useTranslations("Product.crossSocialProof")
  const localeFromContext = useLocale()
  const locale = resolveBinaryCopyLocale(localeFromContext)

  if (!data || !shouldShowProductCrossSocialProof(data)) return null

  const lastSaleLine = formatLastSaleAgoLine(data, locale)
  const showMargins = data.avgMarginCents > 0 || data.topMarginCents > 0
  const isHot = data.activeResellersCount >= 5

  return (
    <motion.aside
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/95 via-white/90 to-fuchsia-50/80 p-3 shadow-sm shadow-violet-500/10 dark:border-violet-800/50 dark:from-violet-950/50 dark:via-zinc-950/80 dark:to-fuchsia-950/35",
        isHot &&
          "border-amber-300/70 from-amber-50/90 via-white/90 to-violet-50/85 dark:border-amber-800/45 dark:from-amber-950/40",
        dense && "rounded-xl p-2.5",
        className
      )}
      aria-label={t("ariaLabel")}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10"
        aria-hidden
      />
      <div className="relative space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
              isHot
                ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                : "bg-violet-600/10 text-violet-800 dark:text-violet-200"
            )}
          >
            {isHot ? <Flame className="size-3" aria-hidden /> : <Zap className="size-3" aria-hidden />}
            {variant === "affiliate" ? t("badgeAffiliate") : t("badgeStorefront")}
          </span>
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
            {t("activeResellers", { count: data.activeResellersCount })}
          </p>
        </div>

        {showMargins ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
            {(() => {
              const marginTrigger = resolveMarginLeaveOnTableTrigger(data)
              if (!marginTrigger) return null
              const leftAmount = formatMarginLeaveEurFromCents(
                marginTrigger.leftOnTableCents,
                locale
              )
              const topAmount = formatMarginTopEurFromCents(marginTrigger.topMarginCents, locale)
              return (
                <span
                  title={t("marginLeaveTableTooltip", {
                    left: leftAmount,
                    top: topAmount,
                  })}
                  className="inline-flex animate-pulse items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-orange-900 dark:text-orange-100"
                >
                  {t("marginLeaveTableBadge", { amount: leftAmount })}
                </span>
              )
            })()}
            {data.avgMarginCents > 0 ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {t("avgMargin", { amount: formatStoreCurrencyFromCents(data.avgMarginCents) })}
              </span>
            ) : null}
            {data.topMarginCents > 0 ? (
              <span className="tabular-nums text-violet-800 dark:text-violet-200">
                {t("topMargin", { amount: formatStoreCurrencyFromCents(data.topMarginCents) })}
              </span>
            ) : null}
          </div>
        ) : null}

        {lastSaleLine ? (
          <p className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">{lastSaleLine}</p>
        ) : null}

        {variant === "affiliate" ? (
          <p className="text-[10px] leading-snug text-violet-800/90 dark:text-violet-200/80">
            {t("fomoHint")}
          </p>
        ) : null}
      </div>
    </motion.aside>
  )
}
