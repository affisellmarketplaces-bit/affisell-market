"use client"

import { Check, Loader2, Sparkles } from "lucide-react"

import {
  GUIDED_WIZARD_CATEGORIES,
  type GuidedCategoryLabel,
  type GuidedCategoryScore,
} from "@/lib/guided-product-ai-shared"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Record<GuidedCategoryLabel, string> = {
  Fashion: "👗",
  Home: "🏠",
  Beauty: "✨",
  Food: "🍽️",
}

type Props = {
  value: GuidedCategoryLabel | ""
  onChange: (value: GuidedCategoryLabel) => void
  scores?: GuidedCategoryScore[]
  recommended?: GuidedCategoryLabel | null
  loading?: boolean
  disabled?: boolean
}

function scoreForLabel(scores: GuidedCategoryScore[], label: GuidedCategoryLabel): number {
  return scores.find((s) => s.label === label)?.confidence ?? 0
}

export function GuidedCategoryPicker({
  value,
  onChange,
  scores = [],
  recommended,
  loading = false,
  disabled = false,
}: Props) {
  const topScore = scores[0]?.confidence ?? 0

  return (
    <div className="mt-1.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {GUIDED_WIZARD_CATEGORIES.map((entry) => {
          const selected = value === entry.label
          const isRecommended = recommended === entry.label
          const confidence = scoreForLabel(scores, entry.label)
          const pct = Math.round(confidence * 100)

          return (
            <button
              key={entry.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(entry.label)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left transition",
                selected
                  ? "border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                  : isRecommended
                    ? "border-violet-400/80 bg-violet-50/90 ring-2 ring-violet-400/30 dark:border-violet-700 dark:bg-violet-950/40"
                    : "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-700",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-lg" aria-hidden>
                  {CATEGORY_ICONS[entry.label]}
                </span>
                {selected ? (
                  <Check className="size-4 shrink-0 opacity-90" aria-hidden />
                ) : isRecommended && !loading ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="size-2.5" aria-hidden />
                    IA
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  "text-sm font-bold",
                  selected ? "text-white" : "text-zinc-900 dark:text-zinc-50"
                )}
              >
                {entry.label}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-snug",
                  selected ? "text-violet-100" : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                {entry.hint}
              </span>
              {confidence > 0 && !selected ? (
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums",
                    confidence >= topScore * 0.85
                      ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  {pct}% match
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-300">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Classification IA en cours…
        </p>
      ) : recommended && !value ? (
        <p className="text-xs text-violet-700 dark:text-violet-300">
          Copilot recommande <strong>{recommended}</strong> — sélection automatique en cours…
        </p>
      ) : null}
    </div>
  )
}
