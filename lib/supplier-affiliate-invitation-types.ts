/** Client-safe types for supplier → affiliate invite APIs (no Prisma). */

export type SupplierAffiliateInvitationListItem = {
  id: string
  token: string
  headline: string
  status: string
  viewCount: number
  offeredCommissionPct: number | null
  affiliateName: string | null
  url: string
  registeredAt: string | null
  listingLiveAt: string | null
  expiresAt: string
  createdAt: string
  expired: boolean
}

export type PublicAffiliateInvitationPayload = {
  token: string
  status: string
  expired: boolean
  headline: string
  personalMessage: string
  offeredCommissionPct: number | null
  categoryHint: string | null
  supplier: {
    name: string
    slug: string | null
    logoUrl: string | null
  }
}
