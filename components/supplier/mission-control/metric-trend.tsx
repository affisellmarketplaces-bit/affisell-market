import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import type { MetricDelta } from "@/lib/supplier-mission-control"
import { bcp47ForAppLocale, formatMoneyFromCents } from "@/lib/app-locale-format"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type Props = {
  delta: MetricDelta
  format?: "currency" | "number"
  className?: string
  locale: AppLocale
  /** When false, only the headline value is shown (no vs prior period). */
  showComparison?: boolean
  stableLabel: string
  naVsPriorLabel: string
  vsPriorLabel: string
}

function formatValue(value: number, format: "currency" | "number", locale: AppLocale) {
  if (format === "currency") {
    return formatMoneyFromCents(value, locale, { maximumFractionDigits: 0 })
  }
  return new Intl.NumberFormat(bcp47ForAppLocale(locale), { maximumFractionDigits: 0 }).format(value)
}

export function MetricTrend({
  delta,
  format = "number",
  className,
  locale,
  showComparison = false,
  stableLabel,
  naVsPriorLabel,
  vsPriorLabel,
}: Props) {
  const pct = delta.pctChange
  const up = pct != null && pct > 0
  const down = pct != null && pct < 0
  const flat = pct === 0 || pct == null
  const bcp47 = bcp47ForAppLocale(locale)

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {formatValue(delta.value, format, locale)}
      </p>
      {showComparison ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {flat ? (
            <span className="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400">
              <Minus className="h-3 w-3" aria-hidden />
              {pct === 0 ? stableLabel : naVsPriorLabel}
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
              {Math.abs(pct!).toLocaleString(bcp47, { maximumFractionDigits: 1 })}%
            </span>
          )}
          <span className="text-zinc-400 dark:text-zinc-500">{vsPriorLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
