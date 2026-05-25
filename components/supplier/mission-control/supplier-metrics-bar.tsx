import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { BarChart3, CircleHelp } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { SupplierWeeklyGoalCard } from "@/components/supplier/mission-control/supplier-weekly-goal-card"
import type { SupplierMetrics7d } from "@/lib/supplier-mission-control"
import type { SupplierWeeklyGoalSnapshot } from "@/lib/supplier-weekly-goal-shared"
import type { AppLocale } from "@/lib/i18n-locale"
import { MetricTrend } from "@/components/supplier/mission-control/metric-trend"
import { cn } from "@/lib/utils"

type Props = {
  metrics: SupplierMetrics7d
  weeklyGoal: SupplierWeeklyGoalSnapshot | null
  locale: AppLocale
}

export async function SupplierMetricsBar({ metrics, weeklyGoal, locale }: Props) {
  const t = await getTranslations("supplierDashboard.metrics")
  const showWeeklyEmpty = !metrics.hasPriorPeriodData && weeklyGoal != null

  const trendLabels = {
    stableLabel: t("stable"),
    naVsPriorLabel: t("naVsPrior"),
    vsPriorLabel: t("vsPrior"),
  }

  return (
    <section aria-labelledby="metrics-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-zinc-400" aria-hidden />
        <h2 id="metrics-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("title")}
        </h2>
      </div>

      {showWeeklyEmpty ? (
        <SupplierWeeklyGoalCard goal={weeklyGoal} locale={locale} />
      ) : !metrics.hasPriorPeriodData ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("notEnoughHistory")}</p>
          <p className="mt-1 text-xs text-zinc-500">{t("trendsAfterWeek")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-200/90 dark:border-zinc-800 dark:bg-zinc-800">
          <MetricCell label={t("gmv")}>
            <MetricTrend
              delta={metrics.gmvCents}
              format="currency"
              showComparison
              locale={locale}
              {...trendLabels}
            />
          </MetricCell>
          <MetricCell label={t("orders")}>
            <MetricTrend
              delta={metrics.orderCount}
              format="number"
              showComparison
              locale={locale}
              {...trendLabels}
            />
          </MetricCell>
          <MetricCell
            label={t("netMargin")}
            hint={
              <span
                className="inline-flex text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title={t("netMarginTooltip")}
                aria-label={t("netMarginTooltip")}
              >
                <CircleHelp className="h-3.5 w-3.5" aria-hidden />
              </span>
            }
          >
            <MetricTrend
              delta={metrics.supplierNetCents}
              format="currency"
              showComparison
              locale={locale}
              {...trendLabels}
            />
          </MetricCell>
          <MetricCell label={t("affiliateCommissions")}>
            <MetricTrend
              delta={metrics.commissionCents}
              format="currency"
              showComparison
              locale={locale}
              {...trendLabels}
            />
          </MetricCell>
        </div>
      )}

      {metrics.topSku ? (
        <Link
          href={`/dashboard/supplier/products/${metrics.topSku.productId}`}
          className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/20"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("topSku")}</p>
          {metrics.topSku.imageUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700">
              <Image src={metrics.topSku.imageUrl} alt="" fill className="object-cover" sizes="40px" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{metrics.topSku.name}</p>
              {metrics.topSku.stockUrgent ? (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950/60 dark:text-red-200">
                  {t("stockoutIn3d")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500">
              {metrics.topSku.units === 1
                ? t("unitsSoldOne", { count: metrics.topSku.units })
                : t("unitsSoldMany", { count: metrics.topSku.units })}
              {metrics.topSku.stockoutDays != null
                ? ` · ${t("stockRemaining", {
                    stock: metrics.topSku.stock,
                    days: metrics.topSku.stockoutDays,
                  })}`
                : null}
            </p>
          </div>
        </Link>
      ) : null}
    </section>
  )
}

function MetricCell({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-2 bg-white px-4 py-4 dark:bg-zinc-950 sm:px-5 sm:py-5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
        {hint}
      </p>
      {children}
    </div>
  )
}
