/**
 * Arbitrage Score™ — cross-border opportunity (Affisell moat).
 * Copy is reseller / no-stock first (see radar-copy.ts).
 */

import {
  RADAR_NO_STOCK_TOOLTIP,
  radarArbitrageBronzeHint,
  radarArbitrageBronzeLabel,
  radarArbitrageGoldHint,
  radarArbitrageGoldLabel,
  radarArbitrageSilverHint,
  radarArbitrageSilverLabel,
} from "@/lib/radar/radar-copy"

export type ArbitrageInput = {
  growthRate: number | null
  searches: number | null
  competition: number | null
  countryCode?: string
}

export type ArbitrageResult = {
  score: number
  tier: "or" | "argent" | "bronze" | "none"
  label: string
  hint: string
  /** Hover tooltip — no-stock explanation */
  tooltip?: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Formula (normalized for UI 0–100):
 * score = (growthRate * 0.45) + (searchNorm * 0.35) − (competition * 2)
 * searchNorm = min(searches / 500, 100)
 */
export function computeArbitrageScore(input: ArbitrageInput): ArbitrageResult {
  const growth = input.growthRate ?? 0
  const searches = input.searches ?? 0
  const competition = input.competition ?? 10
  const searchNorm = Math.min(searches / 500, 100)

  const raw = growth * 0.45 + searchNorm * 0.35 - competition * 2
  const score = Math.round(clamp(raw, 0, 100))

  if (score >= 85) {
    return {
      score,
      tier: "or",
      label: radarArbitrageGoldLabel(score),
      hint: radarArbitrageGoldHint(),
      tooltip: RADAR_NO_STOCK_TOOLTIP,
    }
  }
  if (score >= 70) {
    return {
      score,
      tier: "argent",
      label: radarArbitrageSilverLabel(score),
      hint: radarArbitrageSilverHint(),
      tooltip: RADAR_NO_STOCK_TOOLTIP,
    }
  }
  if (score >= 55) {
    return {
      score,
      tier: "bronze",
      label: radarArbitrageBronzeLabel(score),
      hint: radarArbitrageBronzeHint(),
      tooltip: RADAR_NO_STOCK_TOOLTIP,
    }
  }
  return {
    score,
    tier: "none",
    label: `Score ${score}/100`,
    hint: "Pas d'arbitrage clair",
  }
}
