import type { SalesStats } from "@/lib/listing-sales-count"
import type { ProductHighlight } from "@/lib/product-highlights"

export type ProductShowcaseData = {
  listingId: string
  productId: string
  href: string
  title: string
  subtitle?: string | null
  images: string[]
  price: number
  compareAt?: number | null
  soldCount?: number | null
  /** Confirmed-sales breakdown; drives the sales badge ("bought today" / "this week" / rounded total). */
  sales?: SalesStats
  /** Listed in the last 14 days → "New" badge. */
  isNew?: boolean
  averageRating?: number | null
  reviewCount?: number | null
  highlights?: ProductHighlight[]
  verified?: boolean
  freeShipping?: boolean
  warrantyMonths?: number | null
  stock?: number | null
  /** Variants (size / colour) must be chosen on the product page — the CTA links there instead of adding blindly. */
  needsOptions?: boolean
  sellerName?: string | null
  isBestSeller?: boolean
}
