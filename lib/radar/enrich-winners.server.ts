import "server-only"

import { computeArbitrageScore } from "@/lib/radar/arbitrage-score"
import { computeSaturation } from "@/lib/radar/saturation"
import { matchSuppliersForWinners } from "@/lib/radar/supplier-match.server"
import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"

/** Enrich winners with Arbitrage™ + Saturation + Supplier Match (graceful). */
export async function enrichWorldRadarWinners(
  winners: WorldRadarWinnerDto[]
): Promise<WorldRadarWinnerDto[]> {
  if (winners.length === 0) return winners

  let matchMap = new Map<string, { count: number; sampleNames: string[] }>()
  try {
    matchMap = await matchSuppliersForWinners(winners.map((w) => w.title))
  } catch (err) {
    console.warn("[enrich-winners]", {
      result: "supplier_match_skipped",
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  return winners.map((w) => {
    const arbitrage = computeArbitrageScore({
      growthRate: w.growthRate,
      searches: w.searches,
      competition: w.competition,
      countryCode: w.countryCode,
    })
    const saturation = computeSaturation({
      competition: w.competition,
      searches: w.searches,
      growthRate: w.growthRate,
    })
    const supplierMatch = matchMap.get(w.title) ?? { count: 0, sampleNames: [] }

    return {
      ...w,
      arbitrage,
      saturation,
      supplierMatch,
    }
  })
}
