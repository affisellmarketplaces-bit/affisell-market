/**
 * "Affisell selection" — a curated shelf ranked by TRUST, not by conversions or ad budgets.
 * Pure scoring: every point comes from a verifiable fact (KYC, supplier-declared delivery, real reviews,
 * confirmed sales, a clean title). A listing must carry at least one trust cue to qualify at all.
 */
import { assessTitle } from "@/lib/listing-quality"

export const SELECTION_MIN_SCORE = 45
export const SELECTION_MIN_ITEMS = 4

export type SelectionSignals = {
  title: string
  merchantVerified: boolean
  /** The supplier declared carriers + delivery windows for their shop. */
  hasDeliveryProfile: boolean
  rating: number
  reviewCount: number
  confirmedUnits: number
}

export function scoreSelectionCandidate(s: SelectionSignals): { score: number; qualifies: boolean } {
  const title = assessTitle(s.title)
  // Title (0–20): each issue costs 7.
  let score = Math.max(0, 20 - 7 * title.issues.length)
  if (s.merchantVerified) score += 22
  if (s.hasDeliveryProfile) score += 16
  if (s.reviewCount >= 3) score += s.rating >= 4.5 ? 22 : s.rating >= 4 ? 12 : 0
  if (s.confirmedUnits >= 50) score += 20
  else if (s.confirmedUnits >= 20) score += 14
  else if (s.confirmedUnits >= 5) score += 8
  const hasTrustCue = s.merchantVerified || s.hasDeliveryProfile
  return { score, qualifies: hasTrustCue && title.ok && score >= SELECTION_MIN_SCORE }
}
