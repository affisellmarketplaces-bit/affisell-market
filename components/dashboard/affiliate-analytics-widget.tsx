"use client"

import { BarChart3, LineChart, Wallet } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { BentoCard } from "@/components/affisell/bento-ui"
import type { AffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Props = {
  analytics: AffiliateDashboardAnalytics
}

function formatDayLabel(isoDay: string): string {
  const [, month, day] = isoDay.split("-")
  return `${day}/${month}`
}

function formatEuroCents(value: number): string {
  return formatStoreCurrencyFromCents(value, { maximumFractionDigits: 0 })
}

export function AffiliateAnalyticsWidget({ analytics }: Props) {
  const lineData = analytics.dailyRevenue.map((row) => ({
    day: formatDayLabel(row.day),
    revenue: row.revenueCents / 100,
    orders: row.orders,
  }))

  const barData = analytics.topProductsEpc.map((row) => ({
    name: row.productName.length > 18 ? `${row.productName.slice(0, 16)}…` : row.productName,
    epc: row.epcCents / 100,
    fullName: row.productName,
  }))

  return (
    <BentoCard className="space-y-6 border-zinc-200/80 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Analytics 30j
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {formatEuroCents(analytics.totalRevenue30dCents)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">CA net affilié · 30 derniers jours</p>
        </div>
        <div className="rounded-xl border border-violet-200/80 bg-violet-50/80 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <Wallet className="size-3.5" aria-hidden />
            Payout estimé J+7
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-violet-900 dark:text-violet-100">
            {formatEuroCents(analytics.estimatedPayoutJ7Cents)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LineChart className="size-4 text-zinc-500" aria-hidden />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">CA par jour</p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={lineData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={{ stroke: "#e4e4e7" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "revenue") return [formatEuroCents(Number(value) * 100), "CA"]
                    return [value, "Commandes"]
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e4e4e7",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Top produits EPC</p>
          {barData.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Pas encore de ventes sur 30j — liste un produit Pulse pour démarrer.
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={{ stroke: "#e4e4e7" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    formatter={(value) => [formatEuroCents(Number(value) * 100), "EPC"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined
                      return row?.fullName ?? ""
                    }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e4e4e7",
                      fontSize: "12px",
                    }}
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
