"use client"

import { Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react"

import {
  formatGuidedPrice,
  scoreGuidedTitleLength,
  type GuidedProductAiSuggestion,
} from "@/lib/guided-product-ai-shared"
import { cn } from "@/lib/utils"

type Props = {
  suggestion: GuidedProductAiSuggestion
  loading: boolean
  error: string | null
  currentTitle: string
  onApplyTitle: (title: string) => void
  onApplyAttribute: (key: "material" | "color" | "dimensions" | "price", value: string) => void
  onRefresh: () => void
  compact?: boolean
}

function SuggestionChip({
  label,
  onClick,
  active,
}: {
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-left text-xs font-medium transition",
        active
          ? "border-violet-500 bg-violet-600 text-white shadow-sm shadow-violet-500/30"
          : "border-violet-200/80 bg-white/80 text-violet-900 hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/70"
      )}
    >
      {label}
    </button>
  )
}

export function GuidedAiCopilotPanel({
  suggestion,
  loading,
  error,
  currentTitle,
  onApplyTitle,
  onApplyAttribute,
  onRefresh,
  compact = false,
}: Props) {
  const titleScore = scoreGuidedTitleLength(currentTitle.trim().length)
  const titleOptions = [
    suggestion.recommendedTitle,
    ...suggestion.titleVariants,
  ].filter((t): t is string => typeof t === "string" && t.trim().length > 0)

  const uniqueTitles = [...new Set(titleOptions.map((t) => t.trim()))].slice(0, 4)
  const priceLabel = formatGuidedPrice(suggestion.attributes.suggestedPrice)

  const showPanel =
    loading ||
    Boolean(error) ||
    uniqueTitles.length > 0 ||
    Boolean(suggestion.category) ||
    Boolean(suggestion.attributes.material) ||
    Boolean(suggestion.insight)

  if (!showPanel && !loading) return null

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/95 via-white/90 to-cyan-50/60 p-4 shadow-sm",
        "dark:border-violet-900/50 dark:from-violet-950/50 dark:via-zinc-950/80 dark:to-cyan-950/30",
        compact && "p-3"
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-fuchsia-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-cyan-400/15 blur-3xl",
          loading && "animate-pulse"
        )}
        aria-hidden
      />

      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                Copilot IA Affisell
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {loading
                  ? "Analyse vision + SEO en cours…"
                  : suggestion.visionUsed
                    ? "Photo + titre · suggestions marketplace"
                    : "Titres & catégories optimisés"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200/80 bg-white/70 px-2 py-1 text-[10px] font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden />
            Regénérer
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {error} — continuez manuellement, le wizard reste actif.
          </p>
        ) : null}

        {!loading && currentTitle.trim().length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                titleScore.tone === "good" &&
                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                titleScore.tone === "warn" &&
                  "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
                titleScore.tone === "bad" &&
                  "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              )}
            >
              {currentTitle.trim().length} car. · {titleScore.label}
            </span>
            {suggestion.seoKeywords.slice(0, 3).map((kw) => (
              <span
                key={kw}
                className="rounded-full border border-violet-200/70 bg-white/60 px-2 py-0.5 text-[10px] text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200"
              >
                {kw}
              </span>
            ))}
          </div>
        ) : null}

        {uniqueTitles.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <Wand2 className="size-3" aria-hidden />
              Titres optimisés SEO
            </p>
            <div className="flex flex-wrap gap-2">
              {uniqueTitles.map((title) => (
                <SuggestionChip
                  key={title}
                  label={title}
                  active={currentTitle.trim() === title}
                  onClick={() => onApplyTitle(title)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {suggestion.categoryReason && !compact ? (
          <p className="rounded-lg border border-violet-200/60 bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-600 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-zinc-400">
            <span className="font-semibold text-violet-700 dark:text-violet-300">Catégorie IA :</span>{" "}
            {suggestion.categoryReason}
          </p>
        ) : null}

        {!compact &&
        (suggestion.attributes.material ||
          suggestion.attributes.color ||
          suggestion.attributes.dimensions ||
          priceLabel) ? (
          <div className="space-y-2 border-t border-violet-200/50 pt-3 dark:border-violet-900/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Fiche produit suggérée
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestion.attributes.material ? (
                <SuggestionChip
                  label={`Matériau · ${suggestion.attributes.material}`}
                  onClick={() => onApplyAttribute("material", suggestion.attributes.material!)}
                />
              ) : null}
              {suggestion.attributes.color ? (
                <SuggestionChip
                  label={`Couleur · ${suggestion.attributes.color}`}
                  onClick={() => onApplyAttribute("color", suggestion.attributes.color!)}
                />
              ) : null}
              {suggestion.attributes.dimensions ? (
                <SuggestionChip
                  label={`Dimensions · ${suggestion.attributes.dimensions}`}
                  onClick={() => onApplyAttribute("dimensions", suggestion.attributes.dimensions!)}
                />
              ) : null}
              {priceLabel ? (
                <SuggestionChip
                  label={`Prix · ${priceLabel} €`}
                  onClick={() => onApplyAttribute("price", priceLabel.replace(",", "."))}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {suggestion.insight ? (
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{suggestion.insight}</p>
        ) : null}

        {suggestion.subtitle ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-violet-700 dark:text-violet-300">Accroche :</span>{" "}
            {suggestion.subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}
