import type { ResellerListingVariantSummary } from "@/lib/boutique/reseller-listing-variants-shared"

export type ResellerStorefrontListProduct = {
  id: string
  /** Underlying catalog product — wishlist / likes. */
  productId: string
  title: string
  priceCents: number
  priceLabel: string
  compareAtCents: number | null
  image: string
  isOutOfStock: boolean
  soldCount: number
  isBestSeller: boolean
  buyerRewardBadge: string | null
  variantSummary: ResellerListingVariantSummary
  /** Swatch dots on cards — same resolver as marketplace PDP. */
  colorSwatchNames: string[]
}

export function formatResellerStoreLabel(storeSlug: string): string {
  return storeSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
