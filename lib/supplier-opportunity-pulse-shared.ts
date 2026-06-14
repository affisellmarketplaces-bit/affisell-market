/** Opaque demand metrics for supplier opportunity UI — no commission / resale price. */

export type DemandPulseTier = "scan" | "warm" | "hot" | "surge"

export function computeDemandPulseScore(affiliateViewerCount: number, totalViews: number): number {
  const raw = affiliateViewerCount * 14 + totalViews * 1.8
  return Math.min(100, Math.round(raw))
}

export function demandPulseTier(score: number): DemandPulseTier {
  if (score >= 72) return "surge"
  if (score >= 48) return "hot"
  if (score >= 24) return "warm"
  return "scan"
}

/** Momentum 0–100 from views relative to scouts (listing gap signal). */
export function computeNetworkMomentumPct(affiliateViewerCount: number, totalViews: number): number {
  if (affiliateViewerCount <= 0) return 0
  const ratio = totalViews / affiliateViewerCount
  return Math.min(100, Math.round(ratio * 18))
}

/** Showcase gap: affiliates scouting SKU but not yet listed. */
export function computeShowcaseGapPct(affiliateViewerCount: number): number {
  return Math.min(100, Math.round(affiliateViewerCount * 11))
}
