"use client"

import Link from "next/link"
import { AlertTriangle, BarChart3, LineChart, Wallet } from "lucide-react"
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
import { buttonVariants } from "@/components/ui/button"
import type { SupplierDashboardAnalytics } from "@/lib/supplier-dashboard-analytics-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  analytics: SupplierDashboardAnalytics
}

function formatDayLabel(isoDay: string): string {
  const [, month, day] = isoDay.split("-")
  return `${day}/${month}`
}

function formatEuroCents(value: number): string {
  return formatStoreCurrencyFromCents(value, { maximumFractionDigits: 0 })
}

function formatPayoutDate(isoDay: string | null): string {
  if (!isoDay) return "—"
  const [, month, day] = isoDay.split("-")
  return `${day}/${month}`
}

export function SupplierAnalyticsWidget({ analytics }: Props) {
  const lineData = analytics.dailyRevenue.map((row) => ({
    day: formatDayLabel(row.day),
    revenue: row.revenueCents / 100,
    orders: row.orders,
  }))

  const barData = analytics.topAffiliates.map((row) => ({
    name:
      row.displayName.length > 16 ? `${row.displayName.slice(0, 14)}…` : row.displayName,
    revenue: row.revenueCents / 100,
    fullName: row.displayName,
  }))

  return (
    <BentoCard className="space-y-6 border-zinc-200/80 dark:border-zinc-800">
      {analytics.zeroSalesAlert ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                0 vente depuis J+7 sur au moins un SKU
              </p>
              <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                Boost : baisse le prix wholesale de 10% ou ajoute une vidéo produit.
              </p>
            </div>
          </div>
          <Link href="/dashboard/supplier/products" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
            Booster le catalogue
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Analytics 30j
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {formatEuroCents(analytics.totalRevenue30dCents)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            CA net fournisseur · marge {formatEuroCents(analytics.netMarginCents)} · retours{" "}
            {analytics.returnRatePct}%
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <Wallet className="size-3.5" aria-hidden />
            Prochain payout
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
            {formatEuroCents(analytics.estimatedNextPayoutCents)}
          </p>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
            {analytics.estimatedNextPayoutDate
              ? `le ${formatPayoutDate(analytics.estimatedNextPayoutDate)}`
              : "après livraison confirmée"}
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
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Top affiliés (€ générés)
          </p>
          {barData.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Pas encore de ventes affiliées — augmente la commission catalogue.
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
                    formatter={(value) => [formatEuroCents(Number(value) * 100), "CA net"]}
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
                  <Bar dataKey="revenue" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Performance SKU — tri EPC
        </p>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
              <tr>
                <th className="px-3 py-2 font-semibold">Produit</th>
                <th className="px-3 py-2 font-semibold">Vues</th>
                <th className="px-3 py-2 font-semibold">Clics</th>
                <th className="px-3 py-2 font-semibold">CR</th>
                <th className="px-3 py-2 font-semibold">EPC</th>
              </tr>
            </thead>
            <tbody>
              {analytics.skuPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                    Aucun SKU publié — importe ton catalogue CSV.
                  </td>
                </tr>
              ) : (
                analytics.skuPerformance.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.productName}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.views}</td>
                    <td className="px-3 py-2 tabular-nums">{row.clicks}</td>
                    <td className="px-3 py-2 tabular-nums">{row.conversionRatePct}%</td>
                    <td className="px-3 py-2 tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatEuroCents(row.epcCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </BentoCard>
  )
}
