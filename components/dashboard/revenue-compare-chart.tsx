"use client"

import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  activeDays,
  alignSeries,
  periodChangePct,
  sumCents,
  toCumulative,
  type ComparePoint,
  type DayPoint,
} from "@/lib/analytics-compare"
import { bcp47ForAppLocale, formatMoneyFromCents } from "@/lib/app-locale-format"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type Props = {
  current: DayPoint[]
  previous?: DayPoint[] | null
  /** Brand colour of the current period (emerald for suppliers, violet for resellers). */
  color: string
  className?: string
}

const PREVIOUS_COLOR = "#a1a1aa"

/**
 * Revenue over the window with the PREVIOUS period drawn dashed underneath, a period-over-period badge, a
 * Daily / Cumulative switch (cumulative reads far better when sales are sparse) and a tooltip that compares the
 * same day of both periods. Works without a previous period (then it is a plain revenue curve).
 */
export function RevenueCompareChart({ current, previous, color, className }: Props) {
  const t = useTranslations("dashboardCharts")
  const locale = resolveAppLocale(useLocale())
  const bcp = bcp47ForAppLocale(locale)
  const money = (cents: number) => formatMoneyFromCents(cents, locale, { maximumFractionDigits: 0 })
  const dayLabel = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(bcp, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)) : ""

  const sparse = activeDays(current) < 6
  // One dominant day makes the cumulative curve a flat line then a wall: the daily view shows the peak honestly.
  const total = current.reduce((sum, p) => sum + p.revenueCents, 0)
  const peak = current.reduce((max, p) => Math.max(max, p.revenueCents), 0)
  const spiky = total > 0 && peak / total > 0.6
  const [mode, setMode] = useState<"daily" | "cumulative">(sparse && !spiky ? "cumulative" : "daily")

  const hasPrevious = Boolean(previous && previous.length > 0)
  const rows: ComparePoint[] = useMemo(() => {
    const aligned = alignSeries(current, hasPrevious ? previous : null)
    return mode === "cumulative" ? toCumulative(aligned) : aligned
  }, [current, previous, hasPrevious, mode])

  const totalNow = sumCents(current)
  const totalBefore = hasPrevious ? sumCents(previous!) : 0
  const change = hasPrevious ? periodChangePct(totalNow, totalBefore) : 0
  const noData = totalNow <= 0 && totalBefore <= 0

  const badge = !hasPrevious || noData ? null : change === null ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
      <Sparkles className="size-3" aria-hidden />
      {t("newActivity")}
    </span>
  ) : change === 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <Minus className="size-3" aria-hidden />
      {t("vsPrevious", { pct: "0" })}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        change > 0
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
          : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200"
      )}
    >
      {change > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
      {t("vsPrevious", { pct: `${change > 0 ? "+" : ""}${change}` })}
    </span>
  )

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => {
    if (!active || !payload?.length) return null
    const p = payload[0]!.payload as ComparePoint | undefined
    if (!p) return null
    const delta = p.previousCents != null ? periodChangePct(p.revenueCents, p.previousCents) : null
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{dayLabel(p.day)}</p>
        <p className="mt-1 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
          <span className="inline-block size-2 rounded-full" style={{ background: color }} />
          {money(p.revenueCents)}
          {mode === "daily" ? <span className="text-zinc-500">· {t("orders", { count: p.orders })}</span> : null}
        </p>
        {p.previousCents != null ? (
          <p className="mt-0.5 flex items-center gap-2 text-zinc-500">
            <span className="inline-block size-2 rounded-full" style={{ background: PREVIOUS_COLOR }} />
            {money(p.previousCents)} · {dayLabel(p.previousDay)}
            {delta != null && delta !== 0 ? (
              <span className={delta > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} aria-hidden />
            {t("currentPeriod")}
          </span>
          {hasPrevious ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PREVIOUS_COLOR }} aria-hidden />
              {t("previousPeriod")}
            </span>
          ) : null}
          {badge}
        </div>
        {noData ? null : (
        <div role="group" aria-label={t("viewMode")} className="inline-flex rounded-full bg-zinc-100 p-0.5 text-[11px] font-semibold dark:bg-zinc-800">
          {(["daily", "cumulative"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-2.5 py-1 transition",
                mode === m ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>
        )}
      </div>

      {noData ? (
        <div className="flex h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 px-6 text-center dark:border-zinc-700">
          <svg viewBox="0 0 120 24" className="h-6 w-28 text-zinc-300 dark:text-zinc-600" aria-hidden>
            <line x1="2" y1="20" x2="118" y2="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-zinc-500">{t("noSales")}</p>
        </div>
      ) : (
      <div className="relative h-52 w-full" role="img" aria-label={t("aria", { total: money(totalNow) })}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`rcc-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(v: string) => dayLabel(v)}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={{ stroke: "#e4e4e7" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(v: number) => money(v)}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip content={(props) => renderTooltip(props as unknown as Parameters<typeof renderTooltip>[0])} cursor={{ stroke: "#d4d4d8", strokeDasharray: "3 3" }} />
            {hasPrevious ? (
              <Line
                type="monotone"
                dataKey="previousCents"
                stroke={PREVIOUS_COLOR}
                strokeWidth={1.75}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="revenueCents"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#rcc-${color.replace("#", "")})`}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  )
}
