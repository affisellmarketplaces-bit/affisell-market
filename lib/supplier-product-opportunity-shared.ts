import { affiliateCommissionMaxPct, parseListingKind } from "@/lib/supplier-commission"

export const OPPORTUNITY_COMMISSION_BOOST_PP = 2

export type ProductCommissionOpportunity = {
  productId: string
  productName: string
  /** Supplier-safe thumbnail — no affiliate storefront URL. */
  productImageUrl: string | null
  affiliateViewerCount: number
  totalViews: number
  /** Internal — boost API only; never render in supplier opportunity UI. */
  currentCommissionPct: number
  /** Internal — boost API only; never render in supplier opportunity UI. */
  suggestedCommissionPct: number
  commissionBoostPct: number
  estimatedExtraSales7d: number
  listingKind: string
  demandPulseScore: number
  demandPulseTier: import("@/lib/supplier-opportunity-pulse-shared").DemandPulseTier
  networkMomentumPct: number
  showcaseGapPct: number
}

export function estimateExtraSalesFromOpportunity(affiliateViewerCount: number): number {
  const raw = affiliateViewerCount * 0.15
  return Math.round(raw * 10) / 10
}

export function suggestCommissionPct(
  currentPct: number,
  listingKind: string,
  boostPp = OPPORTUNITY_COMMISSION_BOOST_PP
): { suggested: number; boostPp: number } {
  const max = affiliateCommissionMaxPct(parseListingKind(listingKind))
  const boost = Math.min(boostPp, Math.max(0, max - currentPct))
  return {
    suggested: Math.min(max, currentPct + boost),
    boostPp: boost,
  }
}
