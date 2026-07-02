import type { SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"

const FIXTURE_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&q=80"

/** Stable swipe deck for Playwright — stub `/api/affiliate/swipe-feed` in e2e specs. */
export function e2eAffiliateSwipeFixtureProducts(): SwipeFeedProduct[] {
  return [
    {
      id: "e2e-affiliate-product-alpha",
      name: "E2E Affiliate Alpha",
      imageUrl: FIXTURE_IMAGE,
      images: [FIXTURE_IMAGE],
      categories: ["electronics"],
      basePriceCents: 4_999,
      commissionRate: 15,
      marginCents: 1_500,
      supplierLabel: "E2E Demo Supplier",
      isVerifiedSupplier: true,
      deliveryMax: 5,
    },
    {
      id: "e2e-affiliate-product-beta",
      name: "E2E Affiliate Beta",
      imageUrl: FIXTURE_IMAGE,
      images: [FIXTURE_IMAGE],
      categories: ["home"],
      basePriceCents: 7_499,
      commissionRate: 18,
      marginCents: 2_250,
      supplierLabel: "E2E Demo Supplier",
      isVerifiedSupplier: true,
      deliveryMax: 7,
    },
  ]
}

export function e2eAffiliateCatalogProductFixture(productId: string) {
  const product = e2eAffiliateSwipeFixtureProducts().find((p) => p.id === productId)
  if (!product) return null
  return {
    id: product.id,
    name: product.name,
    description: "E2E fixture product for affiliate onboarding.",
    images: product.images,
    basePriceCents: product.basePriceCents,
    commissionRate: product.commissionRate,
    supplierCommissionRateBps: product.commissionRate * 100,
    colors: [] as string[],
    variants: null,
    hasVariants: false,
    productVariants: [] as Array<{
      color: string | null
      size: string | null
      stock: number
      customData?: unknown
    }>,
    colorImages: [] as Array<{ color: string; hex: string; image: string }>,
  }
}
