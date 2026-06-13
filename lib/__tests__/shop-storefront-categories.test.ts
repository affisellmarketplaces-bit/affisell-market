import { describe, expect, it } from "vitest"

import {
  filterShopProductsByCategory,
  groupShopProductsByCategory,
  STOREFRONT_OTHER_CATEGORY_ID,
} from "@/lib/shop-storefront-categories"
import type { ShopProductCard } from "@/lib/shop-storefront-shared"

const sample = (id: string, category?: ShopProductCard["category"]): ShopProductCard => ({
  listingId: id,
  productId: id,
  name: `Product ${id}`,
  imageUrl: null,
  priceCents: 1000,
  compareAtCents: null,
  freeShipping: false,
  stock: 1,
  averageRating: 0,
  reviewCount: 0,
  category: category ?? null,
})

describe("groupShopProductsByCategory", () => {
  it("groups and counts products", () => {
    const groups = groupShopProductsByCategory([
      sample("1", { id: "c1", slug: "beauty", name: "Beauty", icon: "💄" }),
      sample("2", { id: "c1", slug: "beauty", name: "Beauty", icon: "💄" }),
      sample("3"),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.id === "c1")?.count).toBe(2)
    expect(groups.find((g) => g.id === STOREFRONT_OTHER_CATEGORY_ID)?.count).toBe(1)
  })
})

describe("filterShopProductsByCategory", () => {
  it("filters by category id", () => {
    const products = [
      sample("1", { id: "c1", slug: "tech", name: "Tech", icon: "⚡" }),
      sample("2"),
    ]
    expect(filterShopProductsByCategory(products, "c1")).toHaveLength(1)
    expect(filterShopProductsByCategory(products, STOREFRONT_OTHER_CATEGORY_ID)).toHaveLength(1)
    expect(filterShopProductsByCategory(products, null)).toHaveLength(2)
  })
})
