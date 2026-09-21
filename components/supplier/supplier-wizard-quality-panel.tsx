"use client"

import { ArrowRight, CheckCircle2, Circle } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

export type WizardQualityItem = {
  id: string
  label: string
  done: boolean
  anchorId: string
}

type Props = {
  items: WizardQualityItem[]
  className?: string
}

function progressTextTone(pct: number): string {
  if (pct >= 80) return "text-emerald-700 dark:text-emerald-400"
  if (pct < 50) return "text-red-700 dark:text-red-400"
  return "text-amber-700 dark:text-amber-400"
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const stroke = pct >= 80 ? "stroke-emerald-500" : pct < 50 ? "stroke-red-500" : "stroke-amber-500"
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} className="fill-none stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={cn("fill-none transition-[stroke-dashoffset] duration-500", stroke)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums", progressTextTone(pct))}>
        {pct}%
      </span>
    </div>
  )
}

export function SupplierWizardQualityPanel({ items, className }: Props) {
  const t = useTranslations("supplier.quality")
  const done = items.filter((i) => i.done).length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
  const next = items.find((i) => !i.done)

  const scrollTo = (anchorId: string) => {
    const el = document.getElementById(anchorId)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    const focusable = el.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])"
    )
    focusable?.focus({ preventScroll: true })
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/80",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <ScoreRing pct={pct} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t("title")}</p>
          <p className="mt-0.5 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
            {t("progress", { done, total: items.length })}
          </p>
        </div>
      </div>
      {next ? (
        <button
          type="button"
          onClick={() => scrollTo(next.anchorId)}
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2 text-left text-xs font-semibold text-violet-800 ring-1 ring-violet-200/70 transition hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800/50 dark:hover:bg-violet-950/70"
        >
          <span className="min-w-0 truncate">{t("nextUp", { label: next.label })}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
        </button>
      ) : null}
      <ul className="mt-3 space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => scrollTo(item.anchorId)}
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
              )}
              <span className={item.done ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
