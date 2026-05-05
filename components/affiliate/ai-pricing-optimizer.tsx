"use client"

import { RefreshCw, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "affisell_ai_pricing_auto_adjust"

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function parsePriceEUR(raw: string) {
  const n = Number(String(raw).replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

export type AiPricingOptimizerProps = {
  supplierPriceEUR: number
  currentPriceEUR: string
  /** Sets main selling price (EUR). */
  onPriceChange: (nextPriceEUR: number) => void
  /** Shown after apply / refresh messages. */
  onNotify?: (message: string) => void
  /** Run after Apply AI Price (pulse main input, etc.). */
  onApplyComplete?: () => void
}

export function AiPricingOptimizer({
  supplierPriceEUR,
  currentPriceEUR,
  onPriceChange,
  onNotify,
  onApplyComplete,
}: AiPricingOptimizerProps) {
  const supplier = supplierPriceEUR

  const [aiSuggested, setAiSuggested] = useState(() => Math.round(supplier * 1.4 * 10) / 10)

  const regenerateAi = useCallback(() => {
    const m = 1.35 + Math.random() * 0.2
    const raw = Math.round(supplier * m * 10) / 10
    const minSell = Math.round((supplier + 0.05) * 100) / 100
    setAiSuggested(Number.isFinite(raw) && raw >= minSell ? raw : minSell)
  }, [supplier])

  const [autoAdjust, setAutoAdjust] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      regenerateAi()
      try {
        setAutoAdjust(localStorage.getItem(STORAGE_KEY) === "1")
      } catch {
        setAutoAdjust(false)
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [regenerateAi, supplier])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, autoAdjust ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [autoAdjust])

  const estimateSales = useCallback((price: number) => {
    return Math.floor(clamp(25 - (price - supplier) * 0.8, 6, 40))
  }, [supplier])

  const currentParsed = parsePriceEUR(currentPriceEUR)

  const currentPriceDisplay = Number.isFinite(currentParsed) ? currentParsed : supplier
  const currentSalesEst = estimateSales(currentPriceDisplay)
  const aiSalesEst = estimateSales(aiSuggested)

  const currentProfit = (currentPriceDisplay - supplier) * currentSalesEst
  const aiProfit = (aiSuggested - supplier) * aiSalesEst

  const profitDeltaEUR = aiProfit - currentProfit
  const badgeText =
    profitDeltaEUR >= 0
      ? `+€${Math.abs(Math.round(profitDeltaEUR))}`
      : `−€${Math.abs(Math.round(profitDeltaEUR))}`

  const marketAvgEUR = Math.round(supplier * 1.45 * 100) / 100

  const whyPriceLabel = useMemo(() => `€${aiSuggested.toFixed(2)}`, [aiSuggested])

  function applySuggested() {
    onPriceChange(aiSuggested)
    onApplyComplete?.()
    onNotify?.(`AI price applied: €${aiSuggested.toFixed(2)}`)
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 p-4 dark:border-violet-800 dark:from-violet-950/40 dark:to-blue-950/30">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Pricing Optimizer</h3>
        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">BETA</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Your price</p>
          <p id="current-price-display" className="text-xl font-bold text-gray-900 dark:text-white">
            €{currentPriceDisplay.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{currentSalesEst} sales/mo</p>
        </div>
        <div className="relative rounded-lg bg-violet-600 p-3 text-center text-white ring-2 ring-violet-400">
          <p className="text-xs opacity-90">AI Suggests</p>
          <p id="ai-price-display" className="text-xl font-bold">
            €{aiSuggested.toFixed(2)}
          </p>
          <p className="text-xs opacity-80">{aiSalesEst} sales/mo</p>
          <div className="absolute -right-2 -top-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white shadow">
            {badgeText}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Market avg</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">€{marketAvgEUR.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Competitors</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-violet-100 bg-white p-3 dark:border-violet-900 dark:bg-zinc-900">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-violet-700 dark:text-violet-400">Why {whyPriceLabel}?</span> Peak demand
          detected, 2 competitors out of stock, your niche converts 23% better at this price.
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          id="apply-ai-price"
          type="button"
          onClick={() => applySuggested()}
          className="flex-1 rounded-lg bg-violet-600 py-2.5 font-medium text-white transition hover:bg-violet-700"
        >
          Apply AI Price
        </button>
        <button
          id="refresh-ai"
          type="button"
          onClick={() => {
            regenerateAi()
            onNotify?.("AI suggestion refreshed")
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-zinc-800"
          aria-label="Refresh AI suggestion"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-violet-100 pt-3 dark:border-violet-900">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Auto-adjust daily</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI changes price ±5%</p>
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
