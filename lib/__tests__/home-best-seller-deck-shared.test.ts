import { describe, expect, it } from "vitest"

import { buildBestSellerDeckCards } from "@/lib/home-best-seller-deck-shared"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"

describe("buildBestSellerDeckCards", () => {
  const sample: HomeProductCard = {
    listingId: "list-1",
    productId: "prod-1",
    name: "Wireless Earbuds",
    imageUrl: "https://cdn.example.com/earbuds.jpg",
    priceCents: 4999,
    compareAtCents: null,
    soldCount: 42,
    marginCents: 1200,
    deliveryMin: 2,
    deliveryMax: 5,
    stock: 10,
    freeShipping: true,
    commissionPct: 12,
    averageRating: 4.5,
    reviewCount: 8,
    storeName: "Demo Store",
  }

  it("maps listing fields and rank order", () => {
    const cards = buildBestSellerDeckCards([sample], (count) => `${count} sold`)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      listingId: "list-1",
      name: "Wireless Earbuds",
      imageUrl: "https://cdn.example.com/earbuds.jpg",
      soldLabel: "42 sold",
      rank: 1,
    })
    expect(cards[0]?.priceLabel).toMatch(/49/)
  })
})
