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
    expect(row?.image).toBe("https://cdn.example/x.jpg")
  })

  it("falls back to product image when custom preview is inline", () => {
    const row = normalizeHomeCatalogProduct({
      id: "abc",
      title: "Earbuds",
      price: 29.9,
      customImages: ["data:image/png;base64,abc"],
      images: ["https://cdn.example/fallback.jpg"],
    })
    expect(row?.image).toBe("https://cdn.example/fallback.jpg")
  })
})
