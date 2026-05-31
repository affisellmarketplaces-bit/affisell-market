"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = "brand" | "ai" | "emerald" | "amber" | "rose" | "zinc"

const TONE: Record<
  Tone,
  { surface: string; value: string; icon: string; bar: string }
> = {
  brand: {
    surface:
      "border-brand/25 bg-gradient-to-br from-brand-muted/80 via-white to-white dark:from-brand/15 dark:via-zinc-950 dark:to-zinc-900",
    value: "text-brand dark:text-brand-light",
    icon: "bg-brand/15 text-brand dark:bg-brand/25 dark:text-brand-light",
    bar: "bg-brand",
  },
  ai: {
    surface:
      "border-cyan-400/30 bg-gradient-to-br from-ai-muted/70 via-white to-white dark:from-cyan-950/30 dark:via-zinc-950 dark:to-zinc-900",
    value: "text-cyan-700 dark:text-cyan-300",
    icon: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    bar: "bg-cyan-500",
  },
  emerald: {
    surface:
      "border-emerald-400/30 bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-emerald-950/25 dark:via-zinc-950 dark:to-zinc-900",
    value: "text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  amber: {
    surface:
      "border-amber-400/35 bg-gradient-to-br from-amber-50/90 via-white to-white dark:from-amber-950/25 dark:via-zinc-950 dark:to-zinc-900",
    value: "text-amber-800 dark:text-amber-200",
    icon: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    bar: "bg-amber-500",
  },
  rose: {
    surface:
      "border-rose-400/35 bg-gradient-to-br from-rose-50/90 via-white to-white dark:from-rose-950/25 dark:via-zinc-950 dark:to-zinc-900",
    value: "text-rose-700 dark:text-rose-300",
    icon: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
  },
  zinc: {
    surface: "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/80",
    value: "text-zinc-900 dark:text-white",
    icon: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    bar: "bg-zinc-400",
  },
}

export function AutoFulfillMetricTile({
  label,
  value,
  tone = "zinc",
  icon: Icon,
  hint,
  barPct,
}: {
  label: string
  value: number
  tone?: Tone
  icon: LucideIcon
  hint?: string
  /** 0–100 fill for pipeline tiles */
  barPct?: number
}) {
  const s = TONE[tone]
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md",
        s.surface
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", s.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        {barPct != null ? (
          <span className="text-[10px] font-bold tabular-nums text-zinc-500">{Math.round(barPct)}%</span>
        ) : null}
      </div>
      <p className={cn("mt-3 text-3xl font-black tabular-nums tracking-tight", s.value)}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">{hint}</p> : null}
      {barPct != null ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
          <div
            className={cn("h-full rounded-full transition-all duration-500", s.bar)}
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

export function AutoFulfillSectionShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/90 shadow-lg shadow-brand/5 dark:border-zinc-800/80 dark:bg-zinc-950/90",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-indigo-500 to-cyan-500" aria-hidden />
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light">
              {eyebrow}
            </p>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white sm:text-xl">{title}</h2>
            {description ? (
              <p className="max-w-2xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  )
}
