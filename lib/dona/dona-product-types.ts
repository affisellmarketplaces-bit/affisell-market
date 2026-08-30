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
  /** Live 7d rank when from getBestsellers */
  rank?: number
  /** Orders in rolling window when from getBestsellers */
  soldCount?: number
}

export type DonaProductToolResult = {
  products: DonaProductHit[]
  similarProducts: DonaProductHit[]
  suggestedCategories: string[]
  /** Full ranked list hub — `/bestsellers` */
  hubUrl: string | null
  hubWindow: string | null
}

/** @deprecated alias */
export type DonaSearchToolResult = DonaProductToolResult
