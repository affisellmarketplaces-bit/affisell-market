/** Affisell Pulse — buyer vertical feed (client-safe types). */

export type PulseMediaSlide = {
  url: string
  isVideo: boolean
}

export type PulseFeedSource = "community" | "product"

export type PulseFeedItem = {
  id: string
  source: PulseFeedSource
  productId: string
  listingId: string | null
  storeSlug: string | null
  storeName: string | null
  storeAvatarUrl: string | null
  title: string
  caption: string | null
  priceCents: number
  compareAtCents: number | null
  soldCount: number
  mediaUrl: string
  isVideo: boolean
  /** All product images + videos — tap to cycle in Pulse / Swipe. */
  mediaGallery?: PulseMediaSlide[]
  likes: number
  views: number
  boosted: boolean
  href: string
}
