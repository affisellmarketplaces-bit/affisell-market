"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import type { AffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  economics: AffiliateCatalogCardEconomics
  variant?: "full" | "compact"
  tone?: "light" | "dark"
  className?: string
}

function money(cents: number, opts?: { maximumFractionDigits?: number }) {
  return formatStoreCurrencyFromCents(cents, opts)
}

export function AffiliateCatalogEconomicsPanel({
  economics,
  variant = "full",
  tone = "light",
  className,
}: Props) {
  const t = useTranslations("affiliate.catalogEconomics")
  const isDark = tone === "dark"

  if (variant === "compact") {
    return (
      <div
        className={cn("flex flex-wrap gap-1", className)}
        data-testid="affiliate-catalog-economics-compact"
      >
        <EconomicsChip tone={tone} accent="client">
          {t("customerPriceShort")} {money(economics.suggestedSellingPriceCents, { maximumFractionDigits: 0 })}
        </EconomicsChip>
        <EconomicsChip tone={tone} accent="margin">
          +{money(economics.markupMarginCents, { maximumFractionDigits: 0 })}
        </EconomicsChip>
        <EconomicsChip tone={tone} accent="commission">
          {money(economics.commissionCents, { maximumFractionDigits: 0 })} ({economics.commissionRatePct}%)
        </EconomicsChip>
        <EconomicsChip tone={tone} accent="revenue">
          ≈{money(economics.totalPartnerGainCents, { maximumFractionDigits: 0 })}
        </EconomicsChip>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2.5", className)} data-testid="affiliate-catalog-economics-full">
      <div
        className={cn(
          "rounded-xl border px-3 py-2.5",
          isDark
            ? "border-white/10 bg-white/5"
            : "border-violet-200/70 bg-gradient-to-r from-violet-50/80 to-indigo-50/60 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-indigo-950/20"
        )}
      >
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isDark ? "text-violet-200/80" : "text-violet-700 dark:text-violet-300"
          )}
        >
          {t("customerPrice")}
        </p>
        <p
          className={cn(
            "text-xl font-black tabular-nums tracking-tight",
            isDark ? "text-white" : "text-zinc-900 dark:text-zinc-50"
          )}
        >
          {money(economics.suggestedSellingPriceCents)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p
            className={cn(
              "text-[10px] font-medium uppercase",
              isDark ? "text-zinc-400" : "text-zinc-500"
            )}
          >
            {t("supplierPrice")}
          </p>
          <p
            className={cn(
              "text-sm font-bold tabular-nums",
              isDark ? "text-zinc-100" : "text-zinc-900 dark:text-zinc-50"
            )}
          >
            {money(economics.supplierPriceCents)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-[10px] font-medium uppercase",
              isDark ? "text-violet-300/80" : "text-violet-600 dark:text-violet-400"
            )}
          >
            {t("supplierCommission")}
          </p>
          <p
            className={cn(
              "text-sm font-bold tabular-nums",
              isDark ? "text-violet-200" : "text-violet-700 dark:text-violet-300"
            )}
          >
            {money(economics.commissionCents)}
            <span className="ml-1 text-[10px] font-semibold opacity-80">({economics.commissionRatePct}%)</span>
          </p>
        </div>
      </div>

      <div>
        <p
          className={cn(
            "text-[10px] font-medium uppercase",
            isDark ? "text-emerald-300/80" : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          {t("resellerMargin")}
        </p>
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            isDark ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-300"
          )}
        >
          +{money(economics.markupMarginCents)}
        </p>
      </div>

      <div
        className={cn(
          "rounded-xl px-3 py-2",
          isDark
            ? "bg-gradient-to-r from-emerald-500/20 to-violet-500/20 ring-1 ring-white/10"
            : "bg-gradient-to-r from-emerald-50 to-violet-50 dark:from-emerald-950/40 dark:to-violet-950/30"
        )}
      >
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isDark ? "text-emerald-200/90" : "text-emerald-800 dark:text-emerald-200"
          )}
        >
          {t("estimatedRevenue")}
        </p>
        <p
          className={cn(
            "text-lg font-black tabular-nums",
            isDark ? "text-white" : "text-emerald-900 dark:text-emerald-100"
          )}
        >
          {money(economics.totalPartnerGainCents, { maximumFractionDigits: 0 })}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[10px]",
            isDark ? "text-zinc-400" : "text-emerald-800/70 dark:text-emerald-200/70"
          )}
        >
          {t("estimatedRevenueHint", {
            markupPct: Math.round(economics.suggestedMarkupRate * 100),
          })}
        </p>
      </div>
    </div>
  )
}

function EconomicsChip({
  children,
  tone,
  accent,
}: {
  children: ReactNode
  tone: "light" | "dark"
  accent: "client" | "margin" | "commission" | "revenue"
}) {
  const isDark = tone === "dark"
  const styles = {
    client: isDark
      ? "bg-white/10 text-zinc-100"
      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
    margin: isDark
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    commission: isDark
      ? "bg-violet-500/15 text-violet-200"
      : "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    revenue: isDark
      ? "bg-amber-500/15 text-amber-200"
      : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  } as const

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums", styles[accent])}>
      {children}
    </span>
  )
}
