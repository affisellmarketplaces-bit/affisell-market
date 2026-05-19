"use client"

import { ProductCard, type ProductCardDisplayMode } from "@/components/product/ProductCard"
import { shopProductToCardProps, type ShopProductCard } from "@/lib/shop-storefront-data"

type Props = {
  storeSlug: string
  products: ShopProductCard[]
  /** Set by the server — never derive business fields on the client for buyer pages. */
  mode: ProductCardDisplayMode
}

export function ProductGrid({ storeSlug, products, mode }: Props) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Aucun produit disponible pour le moment.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((item) => (
        <li key={item.listingId}>
          <ProductCard product={shopProductToCardProps(item, storeSlug)} mode={mode} />
        </li>
      ))}
    </ul>
  )
}
