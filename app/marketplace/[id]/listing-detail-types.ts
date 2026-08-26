import type { ReactNode } from "react"
import type { ListingLogisticsInput } from "@/lib/listing-logistics-display"
import type { OfferModeBadge } from "@/lib/product-offer-mode"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import type { AffiliateVariantPricingMap } from "@/lib/affiliate-variant-pricing"
import type { ProductVariantsJson } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"

export type StorefrontInfo = {
  name: string
  slug: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  showTrustedSoldBy: boolean
}

export type ListingShippingBlock = ListingLogisticsInput & {
  processingTime: number
  freeShippingThresholdEUR: number | null
  shippingCarrierIds: string[]
  shippingMethods: string[]
}

export type SpecRow = { label: string; value: string }

export type ListingDetailProps = {
  /** Buyer-facing pages hide wholesale / partner seller attribution. */
  audience?: "customer" | "merchant"
  listingId: string
  productId: string
  listingKind?: string
  /** Affiliate-chosen default color swatch (must exist in `colorNames`). */
  promotedColor?: string | null
  /** Affiliate-chosen default size (must exist in variant size options). */
  promotedSize?: string | null
  name: string
  description: string
  descriptionBullets?: string[]
  descriptionIllustrationImages?: string[]
  descriptionIllustrationVideos?: string[]
  productSpecs?: SpecRow[]
  /** Legal vendeur (fournisseur). */
  sellerLabel: string
  /** Boutique affilié / curateur (optionnel). */
  partnerLabel?: string
  isVerifiedSupplier?: boolean
  supplierTrustTier?: string | null
  storefront: StorefrontInfo | null
  gallery: string[]
  categories: string[]
  colorNames: string[]
  storageOptions?: string[]
  customColumns?: CustomColumn[]
  tags: string[]
  variants: ProductVariantsJson | null
  colorImages: ProductColorImageRow[]
  /** Affiliate custom labels keyed by stable color name */
  colorDisplayLabels?: Record<string, string> | null
  /** Buyer ship-to ISO2 for carrier cards (visitor geo). */
  buyerShipToCountry?: string | null
  shipping: ListingShippingBlock
  listingPriceCents: number
  variantPricing?: AffiliateVariantPricingMap | null
  basePriceCents: number
  stock: number
  /** Ghost Checkout — last live supplier stock probe. */
  lastStockCheck?: string | Date | null
  lastStockStatus?: string | null
  /** Pulse Battle flash — server-validated via ?battleId= */
  battleId?: string | null
  flashPercent?: number | null
  flashPrice?: number | null
  flashEndsAt?: string | null
  isBattleWinner?: boolean
  priceReferenceEur?: number | null
  battleResellerName?: string | null
  retailPriceEur?: number
  has3D?: boolean
  arModel?: string | null
  compactCrossSellSlot?: ReactNode
  crossSellFooterSlot?: ReactNode
  /** Server-hydrated wallet balance — skips client session waterfall when signed in. */
  initialRewardBalanceCents?: number
  reviewSummary: {
    count: number
    average: number
    sentiment: string
    ugcCount?: number
  }
  writeReviewOrderId?: string | null
  openWriteReview?: boolean
  /** Shown near price when the affiliate listing offers buyer cashback / bonus */
  buyerRewardBadge?: string | null
  /** Supplier-declared product condition (refurbished, second-hand, etc.) */
  offerBadge?: OfferModeBadge | null
  /** Loaded client-side via ReviewsEngine → /api/reviews/product/[id] */
  ratingBreakdown?: Record<number, number>
  /** PDP views in the last 24h (analytics) — powers a "trending" signal when high enough. */
  viewsLast24h?: number
  affiliateCreatorsWatching?: number
  /** Paid units on this listing (AffiliateProduct.conversions). */
  salesCount?: number
  /** Supplier listing clip shown under the photo gallery (9:16). */
  galleryListingVideoUrl?: string | null
  /** Affiliate shop PDP (`/shops/:slug`) — use Brand Studio colors instead of Affisell violet. */
  brandedStorefront?: boolean
  tryOnEnabled?: boolean
  tryOnGarmentUrl?: string | null
  tryOnFeatureEnabled?: boolean
  /** Shop PDP with Brand Studio layout `immersive`. */
  storeLayoutImmersive?: boolean
}
