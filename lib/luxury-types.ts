import type { LuxuryTier } from "@/lib/luxury-constants"

export type LuxuryCollectionPublic = {
  id: string
  slug: string
  name: string
  tagline: string | null
  coverImageUrl: string | null
  pieceCount: number
}

export type LuxuryPiecePublic = {
  id: string
  listingId: string
  productId: string
  title: string
  imageUrl: string
  priceCents: number
  compareAtCents: number | null
  storeSlug: string | null
  storeName: string | null
  href: string
  tier: LuxuryTier
  collectionId: string | null
  collectionName: string | null
  prestigeScore: number
}

export type LuxuryAtelierPayload = {
  collections: LuxuryCollectionPublic[]
  pieces: LuxuryPiecePublic[]
  featuredListingId: string | null
  serverTime: string
}
