/** Pulse Live Battle — shared types (client + server). */

export type PulseBattleStatus = "scheduled" | "live" | "ended"

export type BattleProductCard = {
  id: string
  name: string
  image: string | null
  videoUrl: string | null
  priceCents: number
  category: string
  /** Marketplace listing id for buy CTA */
  affiliateProductId: string | null
}

export type BattleVoteChatLine = {
  id: string
  text: string
  createdAt: string
}

export type BattlePayload = {
  id: string
  status: PulseBattleStatus
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  flashEndsAt: string | null
  flashDiscount: number
  votesA: number
  votesB: number
  totalVoters: number
  winnerId: string | null
  productA: BattleProductCard
  productB: BattleProductCard
  pctA: number
  pctB: number
  timeLeftMs: number
  flashTimeLeftMs: number
  alreadyVotedProductId: string | null
  recentVotes: BattleVoteChatLine[]
}

export const BATTLE_DURATION_MS = 15 * 60 * 1000
export const BATTLE_FLASH_MS = 5 * 60 * 1000
export const BATTLE_DEFAULT_FLASH_PCT = 20
