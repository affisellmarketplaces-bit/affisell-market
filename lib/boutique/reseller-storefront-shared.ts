export type ResellerStorefrontListProduct = {
  id: string
  title: string
  priceCents: number
  priceLabel: string
  image: string
  isOutOfStock: boolean
}

export function formatResellerStoreLabel(storeSlug: string): string {
  return storeSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
