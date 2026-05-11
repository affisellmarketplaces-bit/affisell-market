import { normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"

/** EUR cents earned for the buyer on a paid line (after discounts), from listing % offer. */
export function buyerEarnCentsForLinePaid(
  linePaidCents: number,
  listing: { buyerRewardKind: string; buyerRewardPercent: number }
): number {
  const kind = normalizeBuyerRewardKind(listing.buyerRewardKind)
  const pct = Math.max(0, Math.round(listing.buyerRewardPercent))
  if (kind === "NONE" || pct <= 0) return 0
  const paid = Math.max(0, Math.round(linePaidCents))
  return Math.floor((paid * pct) / 100)
}
