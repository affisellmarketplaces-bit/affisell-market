/** Public auction lot — safe for client components (no Prisma). */

export type AuctionLotStatus = "SCHEDULED" | "LIVE" | "ENDING_SOON" | "ENDED"

export type AuctionLotPublic = {
  id: string
  productId: string
  listingId: string | null
  title: string
  imageUrl: string
  storeSlug: string | null
  storeName: string | null
  href: string
  startPriceCents: number
  currentBidCents: number
  bidCount: number
  minNextBidCents: number
  endsAt: string
  status: AuctionLotStatus
  leaderLabel: string | null
  heatScore: number
}

export type AuctionBidPublic = {
  id: string
  auctionId: string
  amountCents: number
  bidderLabel: string
  createdAt: string
}

export type AuctionArenaPayload = {
  lots: AuctionLotPublic[]
  recentBids: AuctionBidPublic[]
  serverTime: string
}
