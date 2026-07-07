"use client"

import { useTranslations } from "next-intl"

import type { AffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  economics: AffiliateCatalogCardEconomics
  className?: string
}

export function AffiliateCatalogEconomicsPanel({ economics, className }: Props) {
  const t = useTranslations("affiliate.catalogEconomics")

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-medium uppercase text-zinc-500">{t("supplierPrice")}</p>
          <p className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatStoreCurrencyFromCents(economics.supplierPriceCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase text-zinc-500">{t("suggestedRetail")}</p>
          <p className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatStoreCurrencyFromCents(economics.suggestedSellingPriceCents)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
            {t("markupMargin")}
          </p>
          <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            +{formatStoreCurrencyFromCents(economics.markupMarginCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase text-violet-600 dark:text-violet-400">
            {t("commission")}
          </p>
          <p className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
            {formatStoreCurrencyFromCents(economics.commissionCents)}
            <span className="ml-1 text-[10px] font-semibold text-violet-500">
              ({economics.commissionRatePct}%)
            </span>
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
        <p className="text-[10px] font-medium uppercase text-emerald-700 dark:text-emerald-300">
          {t("totalGain")}
        </p>
        <p className="text-lg font-black tabular-nums text-emerald-800 dark:text-emerald-200">
          {formatStoreCurrencyFromCents(economics.totalPartnerGainCents, {
            maximumFractionDigits: 0,
          })}
        </p>
        <p className="mt-0.5 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
          {t("totalGainHint", {
            markupPct: Math.round(economics.suggestedMarkupRate * 100),
          })}
        </p>
      </div>
    </div>
  )
}
