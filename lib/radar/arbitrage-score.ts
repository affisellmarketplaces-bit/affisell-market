/**
 * Arbitrage Score™ — cross-border opportunity (Affisell moat).
 * High foreign growth + high search demand − low local competition → gold.
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
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Formula (normalized for UI 0–100):
 * score = (growthRate * 0.45) + (searchNorm * 0.35) − (competition * 2)
 * searchNorm = min(searches / 500, 100)
 * Example: growth 150, searches 40k, competition 2 → ~95 (ARBITRAGE OR)
 */
export function computeArbitrageScore(input: ArbitrageInput): ArbitrageResult {
  const growth = input.growthRate ?? 0
  const searches = input.searches ?? 0
  const competition = input.competition ?? 10
  const searchNorm = Math.min(searches / 500, 100)

  const raw = growth * 0.45 + searchNorm * 0.35 - competition * 2
  const score = Math.round(clamp(raw, 0, 100))

  const country = (input.countryCode ?? "FR").toUpperCase()
  const sourceHint =
    country === "FR"
      ? "Source à l'étranger, vends en FR"
      : `Source au ${country}, vends en FR`

  if (score >= 85) {
    return {
      score,
      tier: "or",
      label: `ARBITRAGE ${score}/100`,
      hint: `${sourceHint} — Marge x3 estimée 🔥`,
    }
  }
  if (score >= 70) {
    return {
      score,
      tier: "argent",
      label: `ARBITRAGE ${score}/100`,
      hint: `${sourceHint} — Marge x2 estimée`,
    }
  }
  if (score >= 55) {
    return {
      score,
      tier: "bronze",
      label: `ARBITRAGE ${score}/100`,
      hint: "Opportunité cross-border à surveiller",
    }
  }
  return {
    score,
    tier: "none",
    label: `Score ${score}/100`,
    hint: "Pas d'arbitrage clair",
  }
}
