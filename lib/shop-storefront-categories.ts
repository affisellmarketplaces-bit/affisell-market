/** Group affiliate storefront products by category — safe for `"use client"`. */

import type { ShopProductCard, ShopProductCategory } from "@/lib/shop-storefront-shared"

export type StorefrontCategoryGroup = ShopProductCategory & { count: number }

export const STOREFRONT_OTHER_CATEGORY_ID = "__other__"

const UNCategorized: ShopProductCategory = {
  id: STOREFRONT_OTHER_CATEGORY_ID,
  slug: "other",
  name: "Other",
  icon: "✨",
}

export function groupShopProductsByCategory(products: ShopProductCard[]): StorefrontCategoryGroup[] {
  const map = new Map<string, StorefrontCategoryGroup>()

  for (const product of products) {
    const cat = product.category ?? UNCategorized
    const existing = map.get(cat.id)
    if (existing) {
      existing.count += 1
      continue
    }
    map.set(cat.id, { ...cat, count: 1 })
  }

  return [...map.values()].sort((a, b) => {
    if (a.id === UNCategorized.id) return 1
    if (b.id === UNCategorized.id) return -1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

export function filterShopProductsByCategory(
  products: ShopProductCard[],
  categoryId: string | null
): ShopProductCard[] {
  if (!categoryId) return products
  if (categoryId === STOREFRONT_OTHER_CATEGORY_ID) {
    return products.filter((p) => !p.category)
  }
  return products.filter((p) => p.category?.id === categoryId)
}
