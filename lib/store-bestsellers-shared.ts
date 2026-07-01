import type { ShopProductCard } from "@/lib/shop-storefront-shared"

/** Top store listings by sold count — client-safe. */
export function pickStoreBestsellerProducts(
  products: ShopProductCard[],
  limit: number
): ShopProductCard[] {
  const n = Math.min(8, Math.max(4, Math.round(limit)))
  return [...products]
    .sort(
      (a, b) =>
        (b.soldCount ?? 0) - (a.soldCount ?? 0) ||
        b.reviewCount - a.reviewCount ||
        b.averageRating - a.averageRating
    )
    .slice(0, n)
}
