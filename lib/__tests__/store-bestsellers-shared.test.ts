import { describe, expect, it } from "vitest"

import { pickStoreBestsellerProducts } from "@/lib/store-bestsellers-shared"
import type { ShopProductCard } from "@/lib/shop-storefront-shared"

function product(id: string, soldCount: number): ShopProductCard {
  return {
    listingId: id,
    productId: id,
    name: `Product ${id}`,
    imageUrl: null,
    priceCents: 1000,
    compareAtCents: null,
    freeShipping: false,
    stock: 5,
    averageRating: 4,
    reviewCount: 2,
    soldCount,
  }
}

describe("pickStoreBestsellerProducts", () => {
  it("sorts by sold count descending", () => {
    const picks = pickStoreBestsellerProducts(
      [product("a", 2), product("b", 10), product("c", 5)],
      4
    )
    expect(picks.map((p) => p.listingId)).toEqual(["b", "c", "a"])
  })

  it("clamps limit between 4 and 8", () => {
    const list = Array.from({ length: 10 }, (_, i) => product(String(i), i))
    expect(pickStoreBestsellerProducts(list, 2)).toHaveLength(4)
    expect(pickStoreBestsellerProducts(list, 99)).toHaveLength(8)
  })
})
