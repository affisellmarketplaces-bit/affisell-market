"use client"

import { BarChart3, LineChart, Wallet } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { BentoCard } from "@/components/affisell/bento-ui"
import { RevenueCompareChart } from "@/components/dashboard/revenue-compare-chart"
import type { AffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics-types"
import { formatMoneyFromCents } from "@/lib/app-locale-format"
import { resolveAppLocale } from "@/lib/i18n-locale"

type Props = {
  analytics: AffiliateDashboardAnalytics
}

export function AffiliateAnalyticsWidget({ analytics }: Props) {
  const t = useTranslations("affiliateDashboard.analytics")
  const locale = resolveAppLocale(useLocale())
  const money = (cents: number) => formatMoneyFromCents(cents, locale, { maximumFractionDigits: 0 })

  const barData = analytics.topProductsEpc.map((row) => ({
    name: row.productName.length > 18 ? `${row.productName.slice(0, 16)}…` : row.productName,
    epc: row.epcCents / 100,
    fullName: row.productName,
  }))

  return (
    <BentoCard id="analytics" className="scroll-mt-24 space-y-6 border-zinc-200/80 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t("title")}</p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {money(analytics.totalRevenue30dCents)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        <div className="rounded-xl border border-violet-200/80 bg-violet-50/80 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <Wallet className="size-3.5" aria-hidden />
            {t("payoutJ7")}
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-violet-900 dark:text-violet-100">
            {money(analytics.estimatedPayoutJ7Cents)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LineChart className="size-4 text-zinc-500" aria-hidden />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dailyRevenue")}</p>
          </div>
          <RevenueCompareChart
            current={analytics.dailyRevenue}
            previous={analytics.previousDailyRevenue}
            color="#7c3aed"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200" title={t("epcHint")}>
            {t("topProducts")}
          </p>
          {barData.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {t("noSales")}
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip
                    formatter={(value) => [money(Number(value) * 100), t("epc")]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined
                      return row?.fullName ?? ""
                    }}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e4e4e7", fontSize: "12px" }}
                  />
                  <Bar dataKey="epc" fill="#a78bfa" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  )
}
