import { describe, expect, it } from "vitest"

import {
  homeCatalogProductHref,
  normalizeHomeCatalogProduct,
} from "@/lib/home-catalog-product-href"

describe("home-catalog-product-href", () => {
  it("builds shop product url when slug is present", () => {
    expect(
      homeCatalogProductHref({ listingId: "abc", storeSlug: "my-shop" })
    ).toBe("/shops/my-shop/product/abc")
  })

  it("normalizes listing rows for static grid", () => {
    const row = normalizeHomeCatalogProduct({
      id: "abc",
      title: "Earbuds",
      price: 29.9,
      image: "https://cdn.example/x.jpg",
    })
    expect(row?.href).toBe("/marketplace/abc")
    expect(row?.priceLabel).toContain("29")
  })
})
