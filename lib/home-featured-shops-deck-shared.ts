import { shopStorefrontPath } from "@/lib/affiliate-routes"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

export type HomeFeaturedShopDeckCard = {
  slug: string
  name: string
  logoUrl: string | null
  href: string
  accent: string
  metaLabel: string
  priceLabel: string | null
}

const DEFAULT_SHOP_ACCENT = "#7c3aed"

export function buildFeaturedShopDeckCards(
  shops: PublicShopDirectoryEntry[],
  labels: {
    rating: (rating: string) => string
    orders: (count: number) => string
    fromPrice: (price: string) => string
  }
): HomeFeaturedShopDeckCard[] {
  return shops.map((shop) => {
    const rating = shop.averageRating
    const metaLabel =
      rating > 0
        ? labels.rating(rating.toFixed(1))
        : shop.orderCount > 0
          ? labels.orders(shop.orderCount)
          : ""

    const priceLabel =
      shop.startingPriceCents != null && shop.startingPriceCents > 0
        ? labels.fromPrice(formatStoreCurrencyFromCents(shop.startingPriceCents))
        : null

    return {
      slug: shop.slug,
      name: shop.name,
      logoUrl: shop.logoUrl,
      href: shopStorefrontPath(shop.slug),
      accent: shop.themeAccent?.trim() || DEFAULT_SHOP_ACCENT,
      metaLabel,
      priceLabel,
    }
  })
}
