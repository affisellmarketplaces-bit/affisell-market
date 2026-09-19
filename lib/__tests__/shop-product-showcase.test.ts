import { describe, expect, it } from "vitest"

import { shopProductToShowcase, type ShopProductCard } from "@/lib/shop-storefront-shared"

const base: ShopProductCard = {
  listingId: "l1",
  productId: "p1",
  name: "Montre Connectée Xiaomi Smart Band 10, Suivi d’Activité, Écran AMOLED, 14j d’autonomie",
  imageUrl: "https://img/a.jpg",
  priceCents: 6799,
  compareAtCents: 8990,
  freeShipping: true,
  stock: 12,
  averageRating: 4.8,
  reviewCount: 1234,
  soldCount: 17,
  warrantyMonths: 24,
  galleryUrls: ["https://img/a.jpg", "https://img/b.jpg"],
  highlights: [{ icon: "screen", label: "Écran AMOLED" }],
  verified: true,
  needsOptions: false,
}

describe("shopProductToShowcase", () => {
  it("splits headline / subtitle and converts cents to euros", () => {
    const s = shopProductToShowcase(base, "marc-boutique")
    expect(s.title).toBe("Montre Connectée Xiaomi Smart Band 10")
    expect(s.subtitle).toContain("Suivi d’Activité")
    expect(s.price).toBeCloseTo(67.99, 2)
    expect(s.compareAt).toBeCloseTo(89.9, 2)
  })

  it("uses the store path, or /product/:id on a dedicated host", () => {
    expect(shopProductToShowcase(base, "marc-boutique").href).toBe("/shops/marc-boutique/product/l1")
    expect(shopProductToShowcase(base, "marc-boutique", { dedicatedHost: true }).href).toBe("/product/l1")
  })

  it("falls back to the primary image when there is no gallery, and to nothing when there is no image", () => {
    expect(shopProductToShowcase({ ...base, galleryUrls: undefined }, "s").images).toEqual(["https://img/a.jpg"])
    expect(shopProductToShowcase({ ...base, galleryUrls: [], imageUrl: null }, "s").images).toEqual([])
  })

  it("carries the flags the card relies on (verified, options, highlights) with safe defaults", () => {
    const s = shopProductToShowcase(base, "s")
    expect(s.verified).toBe(true)
    expect(s.needsOptions).toBe(false)
    expect(s.highlights).toHaveLength(1)
    const bare = shopProductToShowcase({ ...base, verified: undefined, needsOptions: undefined, highlights: undefined }, "s")
    expect(bare.verified).toBe(false)
    expect(bare.needsOptions).toBe(false)
    expect(bare.highlights).toEqual([])
  })
})
