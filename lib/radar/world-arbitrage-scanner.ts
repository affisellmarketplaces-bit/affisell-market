import {
  computeSmartPricing,
  psychologicalPrice,
  resolveSupplierCost,
  type RadarWinner,
} from "@/lib/import/smart-import-enricher"

export type WorldArbitrageWinner = RadarWinner & {
  id?: string
  countryCode?: string | null
}

export type WorldArbitrageTarget = {
  country: string
  price: number
  margin: number
  multiplier: number
}

export type WorldArbitrageScan = {
  bestSource: { country: string; price: number }
  bestTargets: WorldArbitrageTarget[]
  bestOpportunity: { country: string; margin: number; multiplier: number; price: number }
  /** 0–100 opportunity score for UI */
  score: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Multi-country arbitrage scan (simulated targets from supplier cost).
 * CN source → FR / US / SA retail with psychological pricing.
 */
export function scanWorldArbitrage(product: WorldArbitrageWinner): WorldArbitrageScan {
  const cost = resolveSupplierCost(product)
  // Spec snapshot @ 4.2€: FR 14.95 · US 19.95 · SA 22.95 (SA best)
  const fr = psychologicalPrice(cost * 3.2)
  const us = round2(cost * 4.75)
  const sa = round2(cost * (22.95 / 4.2))

  const bestTargets: WorldArbitrageTarget[] = [
    {
      country: "FR",
      price: fr,
      margin: round2(fr - cost),
      multiplier: cost > 0 ? round2(fr / cost) : 3.2,
    },
    {
      country: "US",
      price: us,
      margin: round2(us - cost),
      multiplier: cost > 0 ? round2(us / cost) : 4.75,
    },
    {
      country: "SA",
      price: sa,
      margin: round2(sa - cost),
      multiplier: cost > 0 ? round2(sa / cost) : 5.4,
    },
  ].sort((a, b) => b.margin - a.margin)

  const best = bestTargets[0]!
  // Score: map best multiplier ~3.2→72 … 5.4→92 …
  const score = Math.min(100, Math.max(40, Math.round(best.multiplier * 17)))

  return {
    bestSource: { country: "CN", price: cost },
    bestTargets,
    bestOpportunity: {
      country: best.country,
      margin: best.margin,
      multiplier: best.multiplier,
      price: best.price,
    },
    score,
  }
}

/** FR-local pricing snapshot for catalog badges (cost → sale). */
export function frArbitrageFromCost(costPrice: number, salePrice?: number) {
  const pricing = computeSmartPricing({ title: "", supplierPrice: costPrice })
  const sale = salePrice != null && salePrice > 0 ? salePrice : pricing.salePrice
  const margin = round2(sale - costPrice)
  const multiplier = costPrice > 0 ? round2(sale / costPrice) : 3.2
  const marginPercent = costPrice > 0 ? round2((margin / costPrice) * 100) : 0
  return { costPrice, salePrice: sale, margin, multiplier, marginPercent }
}

/** Parse cost from Radar import customDescription (`cost=4.2`). */
export function parseRadarImportCost(description: string | null | undefined): number | null {
  if (!description) return null
  const m = description.match(/cost=([0-9]+(?:\.[0-9]+)?)/i)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export function isRadarImportDescription(description: string | null | undefined): boolean {
  if (!description) return false
  return /Radar import|world_radar_/i.test(description)
}
