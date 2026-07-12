"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, Target, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import {
  trackSmartMarginApplied,
  trackSmartMarginShown,
  trackSuccessProbabilityShown,
} from "@/lib/analytics/smart-margin-posthog"
import { fetchSmartMarginAnalysis } from "@/lib/ai/smart-margin-client"
import type { MarginAnalysisResponse } from "@/lib/ai/smart-margin-types"
import {
  CONVERSION_DISCLAIMER,
  PROBABILITY_DISCLAIMER,
  REVENUE_DISCLAIMER,
  SMART_MARGIN_FOOTER,
} from "@/lib/legal/disclaimers"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  categoryId: string
  title: string
  catalogPriceEur: number
  currentMargin: number
  onApplyMargin: (margin: number) => void
  className?: string
}

function formatPct(n: number): string {
  return `${n > 0 ? "+" : ""}${Math.round(n * 10) / 10}%`
}

export function SmartMarginAiPanel({
  categoryId,
  title,
  catalogPriceEur,
  currentMargin,
  onApplyMargin,
  className,
}: Props) {
  const [analysis, setAnalysis] = useState<MarginAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const trackedRef = useRef(false)

  const load = useCallback(async () => {
    if (!categoryId.trim() && !title.trim()) return
    setLoading(true)
    const { ok, data } = await fetchSmartMarginAnalysis({
      categoryId: categoryId.trim() || undefined,
      title: title.trim() || undefined,
      catalogPriceEur: catalogPriceEur > 0 ? catalogPriceEur : undefined,
      userMargin: currentMargin,
    })
    setLoading(false)
    if (!ok || !("optimal_margin" in data)) return
    setAnalysis(data)

    if (!trackedRef.current) {
      trackedRef.current = true
      trackSmartMarginShown({
        suggested: data.optimal_margin,
        current: data.current_margin,
        delta_conversion: data.conversion_impact,
        score: data.success_probability.score,
        category_id: categoryId || null,
      })
      trackSuccessProbabilityShown({
        score: data.success_probability.score,
        top_reason: data.success_probability.reasons[0] ?? "",
        risk_count: data.success_probability.risks.length,
      })
    }
  }, [catalogPriceEur, categoryId, currentMargin, title])

  useEffect(() => {
    trackedRef.current = false
    void load()
  }, [load])

  const applyOptimal = () => {
    if (!analysis) return
    onApplyMargin(analysis.optimal_margin)
    trackSmartMarginApplied({
      accepted: true,
      suggested: analysis.optimal_margin,
      current: analysis.current_margin,
      applied_margin: analysis.optimal_margin,
    })
    toast.success(`Conversion estimée ${formatPct(analysis.conversion_impact)}*`)
  }

  const keepCurrent = () => {
    if (!analysis) return
    trackSmartMarginApplied({
      accepted: false,
      suggested: analysis.optimal_margin,
      current: analysis.current_margin,
    })
  }

  if (!categoryId.trim() && !title.trim()) return null

  const sliderPct = Math.min(100, Math.max(0, (currentMargin / 35) * 100))

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/50 p-4 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20",
        className
      )}
      aria-labelledby="smart-margin-heading"
    >
      <h3 id="smart-margin-heading" className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
        <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
        Smart Margin AI
      </h3>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Analyse marché…
        </p>
      ) : analysis ? (
        <>
          <div>
            <p className="text-xs text-zinc-500">Marge actuelle (commission affiliés)</p>
            <p className="mt-1 text-lg font-semibold">{currentMargin}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-violet-600 transition-all"
                style={{ width: `${sliderPct}%` }}
                role="progressbar"
                aria-valuenow={currentMargin}
                aria-valuemin={0}
                aria-valuemax={35}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
            <span className="text-sm text-zinc-600">Marge optimale :</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {analysis.optimal_margin}%
            </span>
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Impact estimé* : {formatPct(analysis.conversion_impact)} conversion,{" "}
            {formatPct(analysis.revenue_impact)} revenu
            <span className="block text-xs text-zinc-500">{CONVERSION_DISCLAIMER}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={applyOptimal}>
              Appliquer {analysis.optimal_margin}%
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={keepCurrent}>
              Garder {currentMargin}%
            </Button>
          </div>

          <div className="border-t border-violet-100 pt-3 dark:border-violet-900/40">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-fuchsia-600" aria-hidden />
              Probabilité de succès* : {analysis.success_probability.score}%
            </p>
            <ul className="mt-2 space-y-1 text-sm text-emerald-800 dark:text-emerald-200">
              {analysis.success_probability.reasons.map((r) => (
                <li key={r}>✓ {r}</li>
              ))}
            </ul>
            {analysis.success_probability.risks.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                {analysis.success_probability.risks.map((r) => (
                  <li key={r}>⚠ {r}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">{PROBABILITY_DISCLAIMER}</p>
          </div>

          {analysis.revenue_estimate_eur != null ? (
            <p className="text-xs text-zinc-600">
              Revenu catalogue estimé* : ~{analysis.revenue_estimate_eur} € / mois
              <span className="block text-zinc-500">{REVENUE_DISCLAIMER}</span>
            </p>
          ) : null}

          {analysis.warnings.length > 0 ? (
            <ul className="text-xs text-amber-700 dark:text-amber-300">
              {analysis.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}

          <p className="text-[10px] leading-relaxed text-zinc-500">{SMART_MARGIN_FOOTER}</p>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Estimation marché indisponible — marge par défaut conservée.</p>
      )}
    </div>
  )
}
