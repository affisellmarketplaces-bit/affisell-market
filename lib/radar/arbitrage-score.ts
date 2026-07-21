/**
 * Arbitrage Score™ — numeric moat (persona copy applied in UI via radar-copy.ts).
 */

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
  tooltip?: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Formula (normalized for UI 0–100):
 * score = (growthRate * 0.45) + (searchNorm * 0.35) − (competition * 2)
 */
export function computeArbitrageScore(input: ArbitrageInput): ArbitrageResult {
  const growth = input.growthRate ?? 0
  const searches = input.searches ?? 0
  const competition = input.competition ?? 10
  const searchNorm = Math.min(searches / 500, 100)

  const raw = growth * 0.45 + searchNorm * 0.35 - competition * 2
  const score = Math.round(clamp(raw, 0, 100))

  // Neutral labels — persona strings come from getRadarCopyForRole in the terminal.
  if (score >= 85) {
    return { score, tier: "or", label: `${score}/100`, hint: "High arbitrage" }
  }
  if (score >= 70) {
    return { score, tier: "argent", label: `${score}/100`, hint: "Medium arbitrage" }
  }
  if (score >= 55) {
    return { score, tier: "bronze", label: `${score}/100`, hint: "Watch" }
  }
  return { score, tier: "none", label: `Score ${score}/100`, hint: "Pas d'arbitrage clair" }
}
