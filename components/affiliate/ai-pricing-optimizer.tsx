"use client"

import { RefreshCw, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  estimateMonthlySales,
  suggestAiMarginsByVariantKey,
  suggestGlobalAiPriceEUR,
} from "@/lib/affiliate-ai-variant-pricing"

const STORAGE_KEY = "affisell_ai_pricing_auto_adjust"

function parsePriceEUR(raw: string) {
  const n = Number(String(raw).replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

export type AiPricingMultiVariantConfig = {
  selectedCount: number
  baseWholesaleCents: number
  options: Array<{ key: string; wholesaleCents: number }>
  selectedKeys: string[]
  onApplyVariantMargins: (marginsByKey: Record<string, string>) => void
}

export type AiPricingOptimizerProps = {
  supplierPriceEUR: number
  currentPriceEUR: string
  /** Sets main selling price (EUR) — reference margin on base SKU. */
  onPriceChange: (nextPriceEUR: number) => void
  onNotify?: (message: string) => void
  onApplyComplete?: () => void
  multiVariant?: AiPricingMultiVariantConfig
  autoAdjust?: boolean
  onAutoAdjustChange?: (enabled: boolean) => void
  /** When false, auto-adjust preference is stored in localStorage only. */
  persistAutoAdjust?: boolean
}

export function AiPricingOptimizer({
  supplierPriceEUR,
  currentPriceEUR,
  onPriceChange,
  onNotify,
  onApplyComplete,
  multiVariant,
  autoAdjust: autoAdjustControlled,
  onAutoAdjustChange,
  persistAutoAdjust = false,
}: AiPricingOptimizerProps) {
  const t = useTranslations("affiliateDashboard.listingBuilder.aiPricing")
  const supplier = supplierPriceEUR

  const [aiSuggested, setAiSuggested] = useState(() => suggestGlobalAiPriceEUR(supplier))

  const regenerateAi = useCallback(() => {
    setAiSuggested(suggestGlobalAiPriceEUR(supplier))
  }, [supplier])

  const [autoAdjustLocal, setAutoAdjustLocal] = useState(false)
  const autoAdjust = autoAdjustControlled ?? autoAdjustLocal

  useEffect(() => {
    if (persistAutoAdjust || autoAdjustControlled !== undefined) return
    const id = window.requestAnimationFrame(() => {
      try {
        setAutoAdjustLocal(localStorage.getItem(STORAGE_KEY) === "1")
      } catch {
        setAutoAdjustLocal(false)
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [autoAdjustControlled, persistAutoAdjust])

  useEffect(() => {
    if (persistAutoAdjust || autoAdjustControlled !== undefined) return
    try {
      localStorage.setItem(STORAGE_KEY, autoAdjustLocal ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [autoAdjustControlled, autoAdjustLocal, persistAutoAdjust])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => regenerateAi())
    return () => window.cancelAnimationFrame(id)
  }, [regenerateAi, supplier])

  const currentParsed = parsePriceEUR(currentPriceEUR)
  const currentPriceDisplay = Number.isFinite(currentParsed) ? currentParsed : supplier
  const currentSalesEst = estimateMonthlySales(currentPriceDisplay, supplier)
  const aiSalesEst = estimateMonthlySales(aiSuggested, supplier)
  const currentProfit = (currentPriceDisplay - supplier) * currentSalesEst
  const aiProfit = (aiSuggested - supplier) * aiSalesEst
  const profitDeltaEUR = aiProfit - currentProfit
  const badgeText =
    profitDeltaEUR >= 0
      ? `+€${Math.abs(Math.round(profitDeltaEUR))}`
      : `−€${Math.abs(Math.round(profitDeltaEUR))}`

  const marketAvgEUR = Math.round(supplier * 1.45 * 100) / 100
  const whyPriceLabel = useMemo(() => `€${aiSuggested.toFixed(2)}`, [aiSuggested])

  const multiActive =
    Boolean(multiVariant) && (multiVariant?.selectedCount ?? 0) > 0

  function setAutoAdjust(next: boolean) {
    if (onAutoAdjustChange) onAutoAdjustChange(next)
    else setAutoAdjustLocal(next)
  }

  function applySuggested() {
    onPriceChange(aiSuggested)
    if (multiActive && multiVariant) {
      const margins = suggestAiMarginsByVariantKey({
        options: multiVariant.options,
        selectedKeys: multiVariant.selectedKeys,
        baseWholesaleCents: multiVariant.baseWholesaleCents,
        globalSuggestedSellEUR: aiSuggested,
      })
      multiVariant.onApplyVariantMargins(margins)
      onNotify?.(t("appliedMulti", { count: Object.keys(margins).length, price: aiSuggested.toFixed(2) }))
    } else {
      onNotify?.(t("appliedSingle", { price: aiSuggested.toFixed(2) }))
    }
    onApplyComplete?.()
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 p-4 dark:border-violet-800 dark:from-violet-950/40 dark:to-blue-950/30">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t("title")}</h3>
        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">{t("beta")}</span>
      </div>

      {multiActive ? (
        <p className="mb-3 text-xs leading-relaxed text-violet-800 dark:text-violet-200">
          {t("multiHint", { count: multiVariant!.selectedCount })}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("yourPrice")}</p>
          <p id="current-price-display" className="text-xl font-bold text-gray-900 dark:text-white">
            €{currentPriceDisplay.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t("salesPerMonth", { count: currentSalesEst })}
          </p>
        </div>
        <div className="relative rounded-lg bg-violet-600 p-3 text-center text-white ring-2 ring-violet-400">
          <p className="text-xs opacity-90">{t("aiSuggests")}</p>
          <p id="ai-price-display" className="text-xl font-bold">
            €{aiSuggested.toFixed(2)}
          </p>
          <p className="text-xs opacity-80">{t("salesPerMonth", { count: aiSalesEst })}</p>
          <div className="absolute -right-2 -top-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white shadow">
            {badgeText}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("marketAvg")}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">€{marketAvgEUR.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{t("competitors")}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-violet-100 bg-white p-3 dark:border-violet-900 dark:bg-zinc-900">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-violet-700 dark:text-violet-400">
            {t("whyPrice", { price: whyPriceLabel })}
          </span>{" "}
          {t("whyBody")}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          id="apply-ai-price"
          type="button"
          onClick={() => applySuggested()}
          className="flex-1 rounded-lg bg-violet-600 py-2.5 font-medium text-white transition hover:bg-violet-700"
        >
          {multiActive ? t("applyMulti") : t("applySingle")}
        </button>
        <button
          id="refresh-ai"
          type="button"
          onClick={() => {
            regenerateAi()
            onNotify?.(t("refreshed"))
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-zinc-800"
          aria-label={t("refreshAria")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-violet-100 pt-3 dark:border-violet-900">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("autoAdjustTitle")}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("autoAdjustHint")}</p>
        </div>
        <label htmlFor="auto-adjust" className="relative inline-flex cursor-pointer items-center">
          <input
            id="auto-adjust"
            type="checkbox"
            className="sr-only"
            checked={autoAdjust}
            onChange={(e) => setAutoAdjust(e.target.checked)}
          />
          <div
            className={`relative h-6 w-11 rounded-full transition-colors focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 ${autoAdjust ? "bg-violet-600" : "bg-gray-200"} dark:bg-gray-700`}
          >
            <span
              className={`absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${autoAdjust ? "translate-x-5" : "translate-x-0"}`}
            />
          </div>
        </label>
      </div>
    </div>
  )
}
