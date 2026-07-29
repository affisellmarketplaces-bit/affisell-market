/** Buyer Battles Hub — client-safe types (no Prisma). */

export type BattlesHubProduct = {
  id: string
  name: string
  image: string | null
  priceCents: number
  affiliateProductId: string | null
}

export type BattlesHubCard = {
  id: string
  status: "scheduled" | "live" | "ended"
  flashDiscount: number
  votesA: number
  votesB: number
  totalVoters: number
  winnerId: string | null
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  flashEndsAt: string | null
  timeLeftMs: number
  flashTimeLeftMs: number
  productA: BattlesHubProduct
  productB: BattlesHubProduct
  pctA: number
  pctB: number
}

export type BattlesHubPayload = {
  live: BattlesHubCard | null
  upcoming: BattlesHubCard[]
  recent: BattlesHubCard[]
  generatedAt: string
}

export const BATTLES_HUB_HREF = "/battles" as const
export const BATTLES_ARENA_HREF = "/pulse/battle" as const
