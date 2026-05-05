/** API + UI shape for Affisell Amazon-style carousels. */
export type CarouselItemJson = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  /** Strikethrough / before price when on sale. */
  compareAtCents: number | null
  stock: number
  deliveryMin: number
  deliveryMax: number
  freeShipping: boolean
  /** Count of `view` events for this product since local midnight (UTC). */
  viewsToday: number
  /** 30d order count for “best sellers” sort. */
  sold30d: number
  /** Whether to show trend badge (views today threshold). */
  isTrending: boolean
  /** Discount % when compareAtCents > price. */
  promoPercent: number | null
  /** For “recommandé” tooltip. */
  contextQuery: string | null
  /** When true, show Affisell AI badge (violet). */
  aiPick: boolean
}
