"use client"

import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { HomeBarometerData } from "@/lib/home-marketplace-cards"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { formatStoreCurrency } from "@/lib/market-config"

type Cat = HomeBarometerData["categories"][number]
type ChartDatum = HomeBarometerData["chartData"][number]

type Props = {
  initialData?: HomeBarometerData | null
}

export function SalesBarometer({ initialData = null }: Props) {
  const [categories, setCategories] = useState<Cat[]>(initialData?.categories ?? [])
  const [chartData, setChartData] = useState<ChartDatum[]>(initialData?.chartData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/analytics/barometer", { cache: "no-store" })
        const json = (await res.json()) as {
          categories?: Cat[]
          chartData?: ChartDatum[]
        }
        if (!cancelled) {
          setCategories(Array.isArray(json.categories) ? json.categories : [])
          setChartData(Array.isArray(json.chartData) ? json.chartData : [])
        }
      } catch {
        if (!cancelled) setError("Impossible de charger le baromètre")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialData])

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-zinc-950 dark:ring-zinc-800">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-zinc-50">
          <TrendingUp className="h-7 w-7 shrink-0 text-green-600" aria-hidden />
          Baromètre des ventes
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Performance globale Affisell · 30 derniers jours
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-gray-500">
          Données globales en cours de collecte. Revenez bientôt pour voir les tendances par catégorie.
        </p>
      ) : (
        <div className="space-y-8">
          {chartData.length > 0 ? (
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => [formatStoreCurrency(Number(value)), "Ventes"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="sales" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <ul className="space-y-5">
            {categories.map((c) => (
              <li key={c.category}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{c.category}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-semibold ${
                        c.isNew || (c.growthPct != null && c.growthPct >= 0)
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {c.isNew ? (
                        "Nouveau"
                      ) : c.growthPct == null ? (
                        "—"
                      ) : (
                        <>
                          {c.growthPct >= 0 ? (
                            <ArrowUpRight className="h-4 w-4" aria-hidden />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" aria-hidden />
                          )}
                          {c.growthPct >= 0 ? "+" : ""}
                          {c.growthPct}%
                        </>
                      )}
                    </span>
                    <span className="text-right text-sm tabular-nums text-gray-700 dark:text-zinc-300">
                      {c.totalLabel}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-green-500 transition-[width]"
                    style={{ width: `${Math.min(100, Math.max(0, c.pctOfTop))}%` }}
                  />
                </div>
                <Link
                  href={categoryBrowsePath(c.categorySlug)}
                  className="mt-2 inline-flex text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                >
                  Vendre en {c.category} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
