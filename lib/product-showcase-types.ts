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
