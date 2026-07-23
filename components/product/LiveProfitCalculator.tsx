"use client"

import { motion, useAnimationControls } from "framer-motion"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import {
  computeNetProfit,
  DEFAULT_PROFIT_PRESET,
  formatProfitEuro,
  PROFIT_PRESETS,
  type ProfitPresetId,
} from "@/lib/profit/profit-presets"
import { cn } from "@/lib/utils"

type Props = {
  cost: number
  suggestedPrice: number
  shippingCost?: number
  minPrice?: number
  maxPrice?: number
  onPriceChange?: (price: number) => void
  className?: string
  /** Show Margin Lock CTA hook */
  showUsePrice?: boolean
  onUsePrice?: (price: number) => void
}

const TONE_CLASS = {
  green: "text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.85)]",
  yellow: "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]",
  red: "text-rose-300 drop-shadow-[0_0_10px_rgba(251,113,133,0.7)]",
} as const

function trackProfitEngaged(productCost: number) {
  console.log("[profit-calculator]", {
    event: "profit_calculator_engaged",
    cost: productCost,
  })
}

export function LiveProfitCalculator({
  cost,
  suggestedPrice,
  shippingCost = 0,
  minPrice,
  maxPrice,
  onPriceChange,
  className,
  showUsePrice = false,
  onUsePrice,
}: Props) {
  const floor = minPrice ?? Math.max(5, Math.round(cost * 1.2 * 100) / 100)
  const ceil = maxPrice ?? Math.max(suggestedPrice * 2, cost * 4, 99)
  const initial = Math.min(ceil, Math.max(floor, suggestedPrice))
  const [salePrice, setSalePrice] = useState(initial)
  const [preset, setPreset] = useState<ProfitPresetId>(DEFAULT_PROFIT_PRESET)
  const slideCount = useRef(0)
  const tracked = useRef(false)
  const controls = useAnimationControls()

  const presetCfg = PROFIT_PRESETS[preset]
  const breakdown = computeNetProfit({
    salePrice,
    cost,
    shippingCost,
    adCost: presetCfg.adCost,
    shopifyFeeRate: presetCfg.shopifyFee,
  })

  useEffect(() => {
    setSalePrice(Math.min(ceil, Math.max(floor, suggestedPrice)))
  }, [suggestedPrice, floor, ceil])

  const applyPrice = (raw: number) => {
    const next = Math.round(raw * 100) / 100
    setSalePrice(next)
    onPriceChange?.(next)
    void controls.start({ scale: [1, 1.1, 1], transition: { duration: 0.28 } })
    slideCount.current += 1
    if (!tracked.current && slideCount.current >= 3) {
      tracked.current = true
      trackProfitEngaged(cost)
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-400/25 bg-black/55 p-4 text-white shadow-[0_0_40px_rgba(16,185,129,0.18)] backdrop-blur-xl",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
          Live Profit · poche nette
        </p>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as ProfitPresetId)}
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-medium text-white/90"
          aria-label="Preset pub"
        >
          {(Object.keys(PROFIT_PRESETS) as ProfitPresetId[]).map((id) => (
            <option key={id} value={id}>
              {PROFIT_PRESETS[id].label}
            </option>
          ))}
        </select>
      </div>

      <label className="block text-xs font-semibold text-white/80">
        Prix vente:{" "}
        <span className="tabular-nums text-white">{salePrice.toFixed(2)}€</span>
      </label>
      <input
        type="range"
        min={floor}
        max={ceil}
        step={0.5}
        value={salePrice}
        onChange={(e) => applyPrice(Number(e.target.value))}
        className="mt-2 w-full accent-emerald-400"
        aria-label="Prix de vente"
      />

      <ul className="mt-4 space-y-1.5 text-xs text-white/70">
        <li className="flex justify-between gap-2">
          <span>Coût produit</span>
          <span className="tabular-nums">-{cost.toFixed(2)}€</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Frais Shopify {(presetCfg.shopifyFee * 100).toFixed(0)}%</span>
          <span className="tabular-nums">-{breakdown.shopifyFee.toFixed(2)}€</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Livraison client</span>
          <span className="tabular-nums">
            {shippingCost <= 0 ? "0€ (inclus)" : `-${shippingCost.toFixed(2)}€`}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Pub estimée</span>
          <span className="tabular-nums">-{breakdown.adCost.toFixed(2)}€</span>
        </li>
      </ul>

      <div className="my-3 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      <motion.p
        animate={controls}
        className={cn("text-center text-3xl font-black tabular-nums", TONE_CLASS[breakdown.tone])}
      >
        BÉNÉFICE NET: {formatProfitEuro(breakdown.profit)}
      </motion.p>
      <p className="mt-1 text-center text-[11px] text-white/60">
        Marge: {breakdown.marginPercent.toFixed(0)}% · ROAS break: {breakdown.roasBreak.toFixed(1)}
      </p>

      {breakdown.profit > 15 ? (
        <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-center text-xs font-semibold text-emerald-200">
          🔥 Produit pépite — Marge &gt;30% possible
        </p>
      ) : null}
      {breakdown.profit < 5 ? (
        <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-xs font-semibold text-rose-200">
          ⚠️ Marge faible — Augmente le prix ou choisis un autre produit
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {showUsePrice && onUsePrice ? (
          <button
            type="button"
            onClick={() => onUsePrice(salePrice)}
            className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.45)] hover:bg-emerald-300"
          >
            Utiliser ce prix →
          </button>
        ) : null}
        <Link
          href="/dashboard/affiliate/catalog?minProfit=15"
          className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold text-white/80 hover:bg-white/10"
        >
          Voir produits +15€ profit
        </Link>
      </div>
    </div>
  )
}
