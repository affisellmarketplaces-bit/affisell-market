/** Buyer-facing product hit for Dona search (listing id = marketplace URL segment). */
export type DonaProductHit = {
  listingId: string
  productId: string
  name: string
  price: number
  imageUrl: string | null
  brand: string
  /** Canonical shopper path — `/marketplace/{listingId}` */
  url: string
}

export type DonaSearchToolResult = {
  products: DonaProductHit[]
  similarProducts: DonaProductHit[]
  suggestedCategories: string[]
}
