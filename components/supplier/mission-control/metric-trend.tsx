import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import type { MetricDelta } from "@/lib/supplier-mission-control"
import { cn } from "@/lib/utils"

type Props = {
  delta: MetricDelta
  format?: "currency" | "number"
  className?: string
}

function formatValue(value: number, format: "currency" | "number") {
  if (format === "currency") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value / 100)
  }
  return new Intl.NumberFormat("fr-FR").format(value)
}

export function MetricTrend({ delta, format = "number", className }: Props) {
  const pct = delta.pctChange
  const up = pct != null && pct > 0
  const down = pct != null && pct < 0
  const flat = pct === 0 || pct == null

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {formatValue(delta.value, format)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {flat ? (
          <span className="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400">
            <Minus className="h-3 w-3" aria-hidden />
            {pct === 0 ? "stable" : "n/a vs 7j préc."}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              up && "text-emerald-600 dark:text-emerald-400",
              down && "text-red-600 dark:text-red-400"
            )}
          >
            {up ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {Math.abs(pct!).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
          </span>
        )}
        <span className="text-zinc-400 dark:text-zinc-500">vs 7j préc.</span>
      </div>
    </div>
  )
}
