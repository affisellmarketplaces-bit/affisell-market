import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export type HomeBestSellerDeckCard = {
  listingId: string
  name: string
  imageUrl: string | null
  priceLabel: string
  soldLabel: string
  rank: number
}

export function buildBestSellerDeckCards(
  products: HomeProductCard[],
  soldLabel: (count: number) => string
): HomeBestSellerDeckCard[] {
  return products.map((product, index) => ({
    listingId: product.listingId,
    name: product.name,
    imageUrl: product.imageUrl,
    priceLabel: formatStoreCurrencyFromCents(product.priceCents),
    soldLabel: soldLabel(product.soldCount),
    rank: index + 1,
  }))
}
