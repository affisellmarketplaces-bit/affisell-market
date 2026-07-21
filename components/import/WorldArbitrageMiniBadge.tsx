"use client"

import { useState } from "react"

import { formatEnrichEuro } from "@/lib/import/smart-import-enricher"
import { scanWorldArbitrage } from "@/lib/radar/world-arbitrage-scanner"
import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"

/**
 * Mini world-arbitrage strip for Radar table rows.
 * Avoids name clash with moat `ArbitrageBadge` inside world-radar-terminal.
 */
export function WorldArbitrageMiniBadge({ row }: { row: WorldRadarWinnerDto }) {
  const [open, setOpen] = useState(false)
  const scan = scanWorldArbitrage({
    title: row.title,
    price: row.price,
    category: row.category,
    countryCode: row.countryCode,
  })
  const fr = scan.bestTargets.find((t) => t.country === "FR")
  const us = scan.bestTargets.find((t) => t.country === "US")
  const sa = scan.bestTargets.find((t) => t.country === "SA")

  const tip = `Meilleur arbitrage: Vendre en ${scan.bestOpportunity.country} pour +${formatEnrichEuro(scan.bestOpportunity.margin)}€`

  return (
    <button
      type="button"
      title={tip}
      onClick={() => setOpen((v) => !v)}
      className="mt-1.5 block max-w-full text-left"
    >
      <span className="inline-flex flex-wrap items-center gap-1 rounded border border-emerald-700/40 bg-zinc-950 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
        <span>{scan.score}/100</span>
        <span className="text-zinc-500">→</span>
        <span>💰</span>
        {fr ? <span>x{fr.multiplier.toFixed(1)} FR</span> : null}
        <span className="text-zinc-600">|</span>
        {us ? <span>x{us.multiplier.toFixed(1)} US</span> : null}
        <span className="text-zinc-600">|</span>
        {sa ? <span>x{sa.multiplier.toFixed(1)} SA</span> : null}
      </span>
      {open ? (
        <span className="mt-1 block rounded bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-900">
          {tip}
        </span>
      ) : null}
    </button>
  )
}
