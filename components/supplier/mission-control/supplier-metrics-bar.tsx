import type { ReactNode } from "react"
import Image from "next/image"
import { BarChart3 } from "lucide-react"

import type { SupplierMetrics7d } from "@/lib/supplier-mission-control"
import { MetricTrend } from "@/components/supplier/mission-control/metric-trend"
import { cn } from "@/lib/utils"

type Props = {
  metrics: SupplierMetrics7d
}

export function SupplierMetricsBar({ metrics }: Props) {
  return (
    <section aria-labelledby="metrics-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-zinc-400" aria-hidden />
        <h2 id="metrics-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Performance · 7 derniers jours
        </h2>
      </div>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-200/90 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCell label="Chiffre d'affaires">
          <MetricTrend delta={metrics.gmvCents} format="currency" />
        </MetricCell>
        <MetricCell label="Commandes">
          <MetricTrend delta={metrics.orderCount} format="number" />
        </MetricCell>
        <MetricCell label="Marge nette (est.)">
          <MetricTrend delta={metrics.supplierNetCents} format="currency" />
        </MetricCell>
        <MetricCell label="Commissions affiliés">
          <MetricTrend delta={metrics.commissionCents} format="currency" />
        </MetricCell>
      </div>

      {metrics.topSku ? (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Top SKU 7j</p>
          {metrics.topSku.imageUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700">
              <Image src={metrics.topSku.imageUrl} alt="" fill className="object-cover" sizes="40px" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{metrics.topSku.name}</p>
            <p className="text-xs text-zinc-500">{metrics.topSku.units} unité{metrics.topSku.units > 1 ? "s" : ""} vendue{metrics.topSku.units > 1 ? "s" : ""}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function MetricCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-2 bg-white px-4 py-4 dark:bg-zinc-950 sm:px-5 sm:py-5")}>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      {children}
    </div>
  )
}
