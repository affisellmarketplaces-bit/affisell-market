import { describe, expect, it } from "vitest"

import { buildHomeCollections, type CollectionListing, type RootCategory } from "@/lib/home-collections"

const L = (n: number, over: Partial<CollectionListing> = {}): CollectionListing => ({
  id: `l${n}`,
  productId: `p${n}`,
  title: `Product ${n}`,
  image: `https://cdn.example/${n}.jpg`,
  href: `/marketplace/l${n}`,
  priceCents: 5000,
  categoryId: "electronics",
  ...over,
})

const roots: RootCategory[] = [
  { id: "electronics", name: "Electronics", subcategoryIds: ["phones"] },
  { id: "home", name: "Home & Garden", subcategoryIds: [] },
]

describe("buildHomeCollections", () => {
  it("builds a category mosaic of exactly 4 distinct real products, including subcategory listings", () => {
    const listings = [L(1), L(2), L(3, { categoryId: "phones" }), L(4), L(5)]
    const out = buildHomeCollections({ listings, roots })
    const cat = out.find((c) => c.kind === "category")!
    expect(cat.kind === "category" && cat.title).toBe("Electronics")
    expect(cat.tiles.map((t) => t.id)).toEqual(["l1", "l2", "l3", "l4"])
  })

  it("drops (never pads) a category that cannot fill a card", () => {
    const listings = [L(1), L(2), L(3), L(4, { categoryId: "home" }), L(5, { categoryId: "home" })]
    expect(buildHomeCollections({ listings, roots }).some((c) => c.kind === "category" && c.categoryId === "home")).toBe(false)
  })

  it("skips duplicate products and listings without an image or title", () => {
    const listings = [L(1), L(2, { productId: "p1" }), L(3, { image: "" }), L(4, { title: " " }), L(5), L(6), L(7)]
    const cat = buildHomeCollections({ listings, roots }).find((c) => c.kind === "category")!
    expect(cat.tiles.map((t) => t.id)).toEqual(["l1", "l5", "l6", "l7"])
  })

  it("builds budget collections from real listing prices; each band leads with products above the previous one", () => {
    const listings = [L(1, { priceCents: 900 }), L(2, { priceCents: 1500 }), L(3, { priceCents: 1900 }), L(4, { priceCents: 2000 }), L(5, { priceCents: 4500 }), L(6, { priceCents: 9000 })]
    const out = buildHomeCollections({ listings, roots })
    const prices = out.filter((c) => c.kind === "price")
    expect(prices.map((c) => c.kind === "price" && c.maxEur)).toEqual([20, 50, 100])
    for (const c of prices) for (const t of c.tiles) expect(t.priceCents).toBeLessThanOrEqual((c.kind === "price" ? c.maxEur : 0) * 100)
    expect(prices[1]!.tiles[0]!.id).toBe("l5") // 45 € leads "under 50 €"
    expect(prices[2]!.tiles[0]!.id).toBe("l6") // 90 € leads "under 100 €"
  })

  it("skips a band that would repeat the previous one exactly", () => {
    const listings = [1, 2, 3, 4].map((n) => L(n, { priceCents: 500 * n }))
    const prices = buildHomeCollections({ listings, roots }).filter((c) => c.kind === "price")
    expect(prices).toHaveLength(1)
  })

  it("returns nothing when the catalog is too small (no empty or padded blocks)", () => {
    expect(buildHomeCollections({ listings: [L(1), L(2)], roots })).toEqual([])
  })

  it("caps the number of category cards", () => {
    const many: RootCategory[] = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, subcategoryIds: [] }))
    const listings = many.flatMap((r, i) => [1, 2, 3, 4].map((k) => L(i * 10 + k, { categoryId: r.id })))
    const cats = buildHomeCollections({ listings, roots: many, maxCategoryCards: 6 }).filter((c) => c.kind === "category")
    expect(cats).toHaveLength(6)
  })
})
