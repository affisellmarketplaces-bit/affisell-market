/** Client-safe Swipe Feed types (no Prisma). */

export type SwipeFeedProduct = {
  id: string
  name: string
  imageUrl: string | null
  images: string[]
  categories: string[]
  basePriceCents: number
  /** Supplier → affiliate commission % (whole number, e.g. 15 = 15%). */
  commissionRate: number
  /** Estimated affiliate margin at default markup (cents). */
  marginCents: number
  supplierLabel: string
  deliveryMax: number | null
}

export type SwipeFeedFilters = {
  categoryId?: string
  niche?: string
  minCommission?: number
  q?: string
}

export type SwipeHistoryEntry = {
  product: SwipeFeedProduct
  action: "like" | "skip"
  listingId?: string
}
