import type { MarketDataSnapshot, SuccessScoreResult } from "@/lib/ai/smart-margin-types"

export type SuccessScoreInput = {
  market: MarketDataSnapshot
  currentMargin: number
  optimalMargin: number
  catalogPriceEur?: number
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function computeSuccessScore(input: SuccessScoreInput): SuccessScoreResult {
  const { market, currentMargin, optimalMargin } = input
  const reasons: string[] = []
  const risks: string[] = []

  // 1. Trend 90d — 30%
  const trendNorm = Math.min(100, Math.max(0, market.trendScore + market.trendSlope90d * 0.5))
  let trendPts = (trendNorm / 100) * 30
  if (market.trendSlope90d >= 20) {
    reasons.push(`Forte demande +${Math.round(market.trendSlope90d)}% ce mois`)
  } else if (market.trendSlope90d > 5) {
    reasons.push(`Demande en hausse +${Math.round(market.trendSlope90d)}%`)
  } else if (market.trendSlope90d < 0) {
    risks.push("Tendance marché en baisse sur 90 j")
    trendPts *= 0.7
  }

  // 2. Competition — 25%
  let competitionPts = 0
  if (market.competition < 10) {
    competitionPts = 25 * (1 - market.competition / 10)
    reasons.push(`Concurrence faible : ${market.competition} vendeurs`)
  } else if (market.competition < 20) {
    competitionPts = 12
  } else {
    competitionPts = 5
    risks.push(`Concurrence élevée : ${market.competition} vendeurs`)
  }

  // 3. Margin vs market — 20%
  const marginGap = Math.abs(optimalMargin - currentMargin)
  let marginPts = 20
  if (marginGap <= 2) {
    reasons.push("Marge alignée sur le marché")
  } else if (marginGap > 6) {
    marginPts = 10
    risks.push(`Écart marge ${Math.round(marginGap)} pts vs estimation marché`)
  }

  // 4. Logistics — 15%
  let logisticsPts = 15
  if (market.supplierLeadTimeHours <= 72) {
    reasons.push("Logistique rapide (<72 h)")
  } else {
    logisticsPts = 8
    risks.push("Délai fournisseur >72 h")
  }

  // 5. Seasonality — 10%
  let seasonPts = 10
  if (market.seasonalityPeakDays != null && market.seasonalityPeakDays <= 30) {
    reasons.push("Pic saisonnier dans les 30 prochains jours")
  } else if (market.seasonalityPeakDays != null && market.seasonalityPeakDays <= 60) {
    seasonPts = 7
    risks.push(`Pic saisonnier dans ${market.seasonalityPeakDays} jours`)
  }

  const hashtagBoost = Math.min(5, market.hashtagVelocity / 20)
  const raw = trendPts + competitionPts + marginPts + logisticsPts + seasonPts + hashtagBoost
  const score = clampScore(raw * (0.55 + market.dataQuality * 0.45) + (market.trendSlope90d > 25 ? 3 : 0))

  if (reasons.length === 0) {
    reasons.push("Signaux marché modérés — ajustez la marge pour optimiser")
  }

  return { score, reasons: reasons.slice(0, 3), risks: risks.slice(0, 2) }
}
