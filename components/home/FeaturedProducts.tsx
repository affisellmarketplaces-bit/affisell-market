import { ProductCard, type ProductCardDisplayMode } from "@/components/product/ProductCard"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import {
  homeProductToCardProps,
  homeProductToCardPropsCustomer,
} from "@/lib/public-home-data"

type Props = {
  products: HomeProductCard[]
  mode: ProductCardDisplayMode
  emptyMessage?: string
}

export function FeaturedProducts({
  products,
  mode,
  emptyMessage = "Aucun produit mis en avant pour le moment.",
}: Props) {
  if (products.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((item) => (
        <li key={item.listingId} className="flex h-full">
          <ProductCard
            product={
              mode === "customer"
                ? homeProductToCardPropsCustomer(item)
                : homeProductToCardProps(item)
            }
            mode={mode}
          />
        </li>
      ))}
    </ul>
  )
}
