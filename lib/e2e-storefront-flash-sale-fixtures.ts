import { endsAtFromPresetHours } from "@/lib/storefront-flash-sale-shared"
import type { ShopProductCard, ShopStoreSummary } from "@/lib/shop-storefront-shared"
import { DEFAULT_STOREFRONT_THEME } from "@/lib/storefront-theme-shared"

const FIXTURE_MEDIA =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&q=80"

/** Playwright — inject active flash sale storefront when `E2E_PULSE_FIXTURES=1` or `?e2eFlashSale=1`. */
export function shouldUseE2eStorefrontFlashSaleFixtures(query: {
  e2eFlashSale?: string | null
}): boolean {
  if (process.env.NODE_ENV === "production") return false
  return process.env.E2E_PULSE_FIXTURES === "1" || query.e2eFlashSale === "1"
}

export function e2eFlashSaleShopFixture(): {
  store: ShopStoreSummary
  products: ShopProductCard[]
} {
  const listingId = "e2e-flash-listing-1"
  const endsAt = endsAtFromPresetHours(24)

  const products: ShopProductCard[] = [
    {
      listingId,
      productId: "e2e-flash-product-1",
      name: "E2E Flash Product",
      imageUrl: FIXTURE_MEDIA,
      priceCents: 4_900,
      compareAtCents: 6_900,
      soldCount: 5,
      stock: 20,
      freeShipping: true,
      averageRating: 4.8,
      reviewCount: 12,
      category: { id: "e2e-cat", name: "Fashion", slug: "fashion", icon: "👗" },
    },
  ]

  const store: ShopStoreSummary = {
    userId: "e2e-flash-user",
    slug: "e2e-flash-shop",
    name: "E2E Flash Shop",
    description: "Playwright flash sale fixture",
    logoUrl: null,
    aiAvatarUrl: null,
    bannerUrl: null,
    nicheLabel: "lifestyle",
    partnerListingCode: "E2E-FLASH",
    theme: {
      ...DEFAULT_STOREFRONT_THEME,
      homepageSections: [
        { type: "hero", enabled: false },
        {
          type: "flash-sale",
          enabled: true,
          content: {
            endsAt,
            listingIds: [listingId],
            eyebrow: "E2E Flash",
            title: "Limited time deals",
          },
        },
        { type: "products", enabled: true },
      ],
    },
  }

  return { store, products }
}
