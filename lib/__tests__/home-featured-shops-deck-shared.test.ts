import { describe, expect, it } from "vitest"

import { buildFeaturedShopDeckCards } from "@/lib/home-featured-shops-deck-shared"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

describe("buildFeaturedShopDeckCards", () => {
  const sample: PublicShopDirectoryEntry = {
    slug: "ecom-store",
    name: "Ecom Store",
    logoUrl: "https://cdn.example.com/logo.png",
    nicheLabel: "tech",
    averageRating: 4.7,
    orderCount: 28,
    startingPriceCents: 1299,
    themeAccent: "#6366f1",
  }

  const labels = {
    rating: (rating: string) => `${rating} ★`,
    orders: (count: number) => `${count} orders`,
    fromPrice: (price: string) => `From ${price}`,
  }

  it("maps shop fields and storefront href", () => {
    const cards = buildFeaturedShopDeckCards([sample], labels)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      slug: "ecom-store",
      name: "Ecom Store",
      href: "/shops/ecom-store",
      accent: "#6366f1",
      metaLabel: "4.7 ★",
    })
    expect(cards[0]?.priceLabel).toMatch(/From/)
  })

  it("falls back to order count when no rating", () => {
    const cards = buildFeaturedShopDeckCards(
      [{ ...sample, averageRating: 0 }],
      labels
    )
    expect(cards[0]?.metaLabel).toBe("28 orders")
  })
})
