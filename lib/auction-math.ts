/** Minimum next bid: +5% or €1 above current (whichever is higher). */
export function minNextBidCents(startPriceCents: number, currentBidCents: number): number {
  const floor = Math.max(0, startPriceCents)
  const current = Math.max(floor, currentBidCents)
  if (current <= 0) return floor
  const bump = Math.max(100, Math.ceil(current * 0.05))
  return current + bump
}

export function anonymizeBidder(userId: string): string {
  const tail = userId.replace(/\W/g, "").slice(-4).toUpperCase() || "0000"
  return `***${tail}`
}

export function auctionHeatScore(bidCount: number, msRemaining: number): number {
  const urgency = msRemaining > 0 ? Math.max(0, 1 - msRemaining / (48 * 3_600_000)) : 1
  return Math.min(100, Math.round(bidCount * 8 + urgency * 40))
}
