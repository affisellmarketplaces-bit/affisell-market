import { describe, expect, it } from "vitest"

import { productsToImages } from "@/lib/buyer-premium-discover.server"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"

function stub(partial: Partial<HomeProductCard> & Pick<HomeProductCard, "listingId" | "name">): HomeProductCard {
  return {
    productId: partial.productId ?? partial.listingId,
    imageUrl: partial.imageUrl ?? null,
    priceCents: 1000,
    compareAtCents: null,
    soldCount: 0,
    marginCents: 100,
    deliveryMin: 3,
    deliveryMax: 7,
    stock: 10,
    freeShipping: true,
    commissionPct: 10,
    averageRating: 4.5,
    reviewCount: 2,
    storeName: "Demo",
    ...partial,
  }
}

describe("productsToImages (Discover tiles)", () => {
  it("resolves remote CDN urls and caps at 3 tiles", () => {
    const tiles = productsToImages([
      stub({ listingId: "a", name: "Sac", imageUrl: "https://cdn.example/a.jpg" }),
      stub({ listingId: "b", name: "Tabi", imageUrl: "https://cdn.example/b.jpg" }),
      stub({ listingId: "c", name: "Device", imageUrl: "https://cdn.example/c.jpg" }),
      stub({ listingId: "d", name: "Extra", imageUrl: "https://cdn.example/d.jpg" }),
    ])
    expect(tiles).toHaveLength(3)
    expect(tiles[0]?.src).toBe("https://cdn.example/a.jpg")
    expect(tiles[0]?.href).toBe("/marketplace/a")
  })

  it("falls back to listing-card proxy when only base64 is available", () => {
    const tiles = productsToImages([
      stub({ listingId: "listing-1", name: "Base64 only", imageUrl: "data:image/png;base64,xxx" }),
    ])
    expect(tiles).toHaveLength(1)
    expect(tiles[0]?.src).toBe("/api/listing-card-image/listing-1")
  })
})
