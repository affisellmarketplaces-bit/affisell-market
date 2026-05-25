/** Client-safe types for supplier invite APIs (no Prisma). */

export type AffiliateInvitationListItem = {
  id: string
  token: string
  headline: string
  status: string
  viewCount: number
  offeredCommissionPct: number | null
  supplierName: string | null
  url: string
  registeredAt: string | null
  catalogLiveAt: string | null
  expiresAt: string
  createdAt: string
  expired: boolean
}

export type PublicSupplierInvitationPayload = {
  token: string
  status: string
  expired: boolean
  headline: string
  personalMessage: string
  offeredCommissionPct: number | null
  categoryHint: string | null
  affiliate: {
    name: string
    slug: string | null
    logoUrl: string | null
    tiktok: string | null
  }
}
