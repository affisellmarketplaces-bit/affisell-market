"use client"

import { CheckCircle2, Circle } from "lucide-react"
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

function progressTone(pct: number): string {
  if (pct >= 80) return "bg-emerald-500"
  if (pct < 50) return "bg-red-500"
  return "bg-amber-500"
}

function progressTextTone(pct: number): string {
  if (pct >= 80) return "text-emerald-700 dark:text-emerald-400"
  if (pct < 50) return "text-red-700 dark:text-red-400"
  return "text-amber-700 dark:text-amber-400"
}

export function SupplierWizardQualityPanel({ items, className }: Props) {
  const t = useTranslations("supplier.quality")
  const done = items.filter((i) => i.done).length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0

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
        "rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("title")}
        </p>
        <p className={cn("text-sm font-bold tabular-nums", progressTextTone(pct))}>{pct}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all duration-300", progressTone(pct))}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => scrollTo(item.anchorId)}
              className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm transition hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
              )}
              <span className={item.done ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
