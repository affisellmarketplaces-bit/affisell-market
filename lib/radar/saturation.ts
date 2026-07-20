/**
 * Saturation Index + days-until-full prediction (Affisell moat).
 */

export type SaturationInput = {
  competition: number | null
  searches: number | null
  growthRate: number | null
}

export type SaturationTier = "vierge" | "tot" | "sature"

export type SaturationResult = {
  /** 0–100+ index (competition / searches * 100) */
  index: number
  tier: SaturationTier
  label: string
  emoji: string
  /** Estimated days until saturation threshold (~30) */
  daysUntilSaturation: number | null
  prediction: string | null
  /** 0–100 for progress bar (capped) */
  barPercent: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function computeSaturation(input: SaturationInput): SaturationResult {
  const competition = Math.max(0, input.competition ?? 0)
  const searches = Math.max(1, input.searches ?? 1)
  const growth = Math.max(1, input.growthRate ?? 1)

  const index = (competition / searches) * 100
  // Scale for UI: raw index is tiny (e.g. 4/22000*100 ≈ 0.02). Use competition-weighted score.
  // Practical saturation proxy: competition relative to demand density.
  const practical = clamp((competition / Math.max(searches / 2000, 1)) * 10, 0, 100)

  let tier: SaturationTier
  let label: string
  let emoji: string
  if (practical < 10) {
    tier = "vierge"
    label = "Vierge"
    emoji = "🟢"
  } else if (practical <= 30) {
    tier = "tot"
    label = "Tôt"
    emoji = "🟡"
  } else {
    tier = "sature"
    label = "Saturé"
    emoji = "🔴"
  }

  // days = (30 - practical) / (growthRate / 30)
  let daysUntilSaturation: number | null = null
  let prediction: string | null = null
  if (practical < 30) {
    const dailyPressure = growth / 30
    const remaining = 30 - practical
    daysUntilSaturation = Math.max(1, Math.round(remaining / Math.max(dailyPressure, 0.1)))
    prediction = `📈 Va saturer dans ~${daysUntilSaturation} jours à ce rythme`
  } else {
    prediction = "⚠️ Marché déjà saturé — marge sous pression"
  }

  return {
    index: Math.round(index * 1000) / 1000,
    tier,
    label,
    emoji,
    daysUntilSaturation,
    prediction,
    barPercent: Math.round(practical),
  }
}
