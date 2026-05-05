"use client"

import { RefreshCw, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "affisell_ai_pricing_auto_adjust"

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function formatEUR(value: number) {
  const fixed = value.toFixed(2)
  return fixed.endsWith(".00") ? `€${value.toFixed(0)}` : `€${fixed}`
}

function parsePriceEUR(raw: string) {
  const n = Number(String(raw).replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

/** Accessible switch — no radix Switch in repo */
function AiPricingSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
        checked ? "border-violet-600 bg-violet-600" : "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 translate-y-0 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
        style={{ marginTop: 1 }}
      />
    </button>
  )
}

export type AiPricingOptimizerProps = {
  supplierPriceEUR: number
  currentPriceEUR: string
  /** Called when user applies AI price, picks chart tier, etc. Price in EUR. */
  onPriceChange: (nextPriceEUR: number) => void
  /** Optional toast / banner hook */
  onNotify?: (message: string) => void
}

export function AiPricingOptimizer({
  supplierPriceEUR,
  currentPriceEUR,
  onPriceChange,
  onNotify,
}: AiPricingOptimizerProps) {
  const supplier = supplierPriceEUR

  const [aiSuggested, setAiSuggested] = useState(() => Math.round(supplier * 1.4 * 10) / 10)

  const [highlightTierIndex, setHighlightTierIndex] = useState(2)

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
      setHighlightTierIndex(2)
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

  const tierPricesEUR = useMemo(() => {
    const lo = Math.round(supplier * 1.1 * 10) / 10
    const hi = Math.round(supplier * 1.65 * 10) / 10
    const span = hi - lo
    return [0, 1, 2, 3, 4].map((i) => Math.round((lo + (span / 4) * i) * 10) / 10)
  }, [supplier])

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

  const tierProfits = useMemo(() => tierPricesEUR.map((p) => (p - supplier) * estimateSales(p)), [
    tierPricesEUR,
    supplier,
    estimateSales,
  ])
  const maxProfit = Math.max(...tierProfits, 1)

  function applySuggested() {
    onPriceChange(aiSuggested)
    const idx = tierPricesEUR.reduce((best, p, i) => {
      const d = Math.abs(p - aiSuggested)
      const bd = Math.abs(tierPricesEUR[best]! - aiSuggested)
      return d < bd ? i : best
    }, 0)
    setHighlightTierIndex(idx)
    onNotify?.(`AI price applied: €${aiSuggested.toFixed(2)}`)
  }

  function onBarClick(i: number) {
    const p = tierPricesEUR[i]
    if (p == null) return
    setHighlightTierIndex(i)
    onPriceChange(p)
  }

  const chartLabels = tierPricesEUR.map((p) => {
    const s = p.toFixed(2)
    if (s.endsWith(".90") || s.endsWith(".89")) return `€${p.toFixed(1)}`
    if (Math.abs(p - Math.round(p)) < 0.05) return `€${Math.round(p)}`
    return formatEUR(p)
  })

  return (
    <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-4 dark:from-violet-950/40 dark:to-blue-950/30 dark:border-violet-800">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Pricing Optimizer</h3>
        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">BETA</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 transition hover:border-violet-200 dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Your price</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatEUR(currentPriceDisplay)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{currentSalesEst} sales/mo est.</p>
        </div>
        <div className="relative rounded-lg bg-violet-600 p-3 text-white ring-2 ring-violet-400 transition hover:bg-violet-700 dark:bg-violet-600">
          <p className="text-xs opacity-90">AI Suggests</p>
          <p className="text-xl font-bold">{formatEUR(aiSuggested)}</p>
          <p className="text-xs opacity-80">{aiSalesEst} sales/mo est.</p>
          <div className="absolute -right-2 -top-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
            {badgeText}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 transition hover:border-violet-200 dark:border-gray-700 dark:bg-zinc-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Market avg</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatEUR(marketAvgEUR)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Competitors</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-violet-100 bg-white p-3 dark:border-violet-900 dark:bg-zinc-900">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-violet-700 dark:text-violet-400">Why {formatEUR(aiSuggested)}?</span> Peak
          demand detected (Friday 6PM), 2 competitors out of stock, your niche converts 23% better at this price
          point.
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => applySuggested()}
          className="flex-1 rounded-lg bg-violet-600 py-2.5 font-medium text-white transition hover:bg-violet-700"
        >
          Apply AI Price
        </button>
        <button
          type="button"
          onClick={() => {
            regenerateAi()
            setHighlightTierIndex(2)
            onNotify?.("AI suggestion refreshed")
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-zinc-800"
          title="Refresh AI suggestion"
          aria-label="Refresh AI suggestion"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-violet-100 pt-3 dark:border-violet-900">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Auto-adjust daily</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI changes price ±5% to maximize profit</p>
        </div>
        <AiPricingSwitch checked={autoAdjust} onCheckedChange={setAutoAdjust} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Profit projection</p>
        <div className="flex h-16 items-end gap-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-zinc-900">
          {tierProfits.map((profit, i) => {
            const h = `${Math.round((profit / maxProfit) * 100)}%`
            const active = highlightTierIndex === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => onBarClick(i)}
                title={formatEUR(tierPricesEUR[i]!)}
                className={`flex-1 min-h-[12px] rounded-t transition hover:opacity-90 ${
                  active ? "bg-violet-600 ring-2 ring-violet-400 ring-offset-1" : "bg-gray-200 dark:bg-gray-600"
                }`}
                style={{ height: h }}
              />
            )
          })}
        </div>
        <div className="mt-1 flex justify-between gap-1 text-[10px] text-gray-400 sm:text-xs">
          {chartLabels.map((lbl, i) => (
            <span
              key={i}
              className={highlightTierIndex === i ? "font-medium text-violet-600 dark:text-violet-400" : ""}
            >
              {lbl}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
