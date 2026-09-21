"use client"

import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import type { GuidedTaxonomySuggestion } from "@/components/supplier/use-guided-taxonomy-suggestions"
import { cn } from "@/lib/utils"

type Props = {
  suggestions: GuidedTaxonomySuggestion[]
  recommendedLeafId: string | null
  selectedLeafId: string
  loading: boolean
  failed: boolean
  /** True once a title or a durable photo exists (before that we only show the hint). */
  hasSignal: boolean
  onSelect: (suggestion: GuidedTaxonomySuggestion | null) => void
  onRetry: () => void
  disabled?: boolean
}

/** "Home › Kitchen › Blenders" → leaf "Blenders" + trail "Home › Kitchen". */
export function splitBreadcrumb(breadcrumb: string): { leaf: string; trail: string } {
  const parts = breadcrumb.split(/\s*[›>/]\s*/).filter(Boolean)
  const leaf = parts[parts.length - 1] ?? breadcrumb
  return { leaf, trail: parts.slice(0, -1).join(" › ") }
}

export function GuidedTaxonomySuggestions({
  suggestions,
  recommendedLeafId,
  selectedLeafId,
  loading,
  failed,
  hasSignal,
  onSelect,
  onRetry,
  disabled = false,
}: Props) {
  const t = useTranslations("supplier.guidedTaxonomy")

  return (
    <div className="mt-1.5 space-y-2" aria-live="polite">
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-300">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("analysing")}
          </p>
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" aria-hidden />
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div role="radiogroup" aria-label={t("title")} className="space-y-2">
          {suggestions.map((s) => {
            const selected = selectedLeafId === s.leafId
            const best = recommendedLeafId === s.leafId
            const { leaf, trail } = splitBreadcrumb(s.breadcrumb)
            const pct = typeof s.confidence === "number" && s.confidence > 0 ? Math.round(s.confidence * 100) : null
            return (
              <button
                key={s.leafId}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelect(selected ? null : s)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  selected
                    ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : best
                      ? "border-violet-400/80 bg-violet-50/90 ring-1 ring-violet-400/30 dark:border-violet-700 dark:bg-violet-950/40"
                      : "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-700",
                  disabled && "pointer-events-none opacity-60"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", selected ? "text-white" : "text-zinc-900 dark:text-zinc-50")}>
                    {leaf}
                  </span>
                  {trail ? (
                    <span className={cn("block truncate text-[11px]", selected ? "text-violet-100" : "text-zinc-500 dark:text-zinc-400")}>
                      {trail}
                    </span>
                  ) : null}
                </span>
                {best && !selected ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="size-2.5" aria-hidden />
                    {t("bestMatch")}
                  </span>
                ) : pct != null && !selected ? (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {t("match", { pct })}
                  </span>
                ) : null}
                {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      ) : failed ? (
        <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          {t("unavailable")}
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
            <RefreshCw className="size-3" aria-hidden />
            {t("retry")}
          </button>
        </p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hasSignal ? t("noneFound") : t("hint")}</p>
      )}
    </div>
  )
}
