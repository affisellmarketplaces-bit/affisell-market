import { describe, expect, it } from "vitest"

import { normalizeSearchText, searchStoreProducts, type SearchableProduct } from "@/lib/storefront/storefront-search"

const p = (listingId: string, name: string, category: string | null = null): SearchableProduct => ({
  listingId,
  name,
  priceCents: 1000,
  imageUrl: null,
  category,
})

const CATALOG = [
  p("1", "Legging sport taille haute noir", "Sport"),
  p("2", "Café moulu bio 250 g", "Épicerie"),
  p("3", "Table de jeu gaming 80x52 cm en carbone", "Maison"),
  p("4", "Console de jeu vidéo portable RG40XX V", "Jeux"),
  p("5", "Black leggings seamless", "Sport"),
  p("6", "Casserole vapeur à 5 niveaux", "Cuisine"),
]
const ids = (r: SearchableProduct[]) => r.map((x) => x.listingId)

describe("normalizeSearchText", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalizeSearchText("  Café  MOULU, bio! ")).toBe("cafe moulu bio")
    expect(normalizeSearchText("Crème-brûlée / N°5")).toBe("creme brulee n 5")
  })
})

describe("searchStoreProducts", () => {
  it("is accent- and case-insensitive, both ways", () => {
    expect(ids(searchStoreProducts(CATALOG, "cafe"))).toEqual(["2"])
    expect(ids(searchStoreProducts(CATALOG, "CAFÉ"))).toEqual(["2"])
    expect(ids(searchStoreProducts(CATALOG, "epicerie"))).toEqual(["2"]) // category match
  })

  it("every word must match: more words narrow the result", () => {
    expect(ids(searchStoreProducts(CATALOG, "jeu"))).toContain("3")
    expect(ids(searchStoreProducts(CATALOG, "jeu vidéo"))).toEqual(["4"])
    expect(searchStoreProducts(CATALOG, "jeu casserole")).toEqual([])
  })

  it("ranks: name start › word start › inside › category only", () => {
    const list = [p("a", "Housse noire pour legging"), p("b", "Legging noir"), p("c", "Sac", "Leggings & co"), p("d", "Mini-leggings")]
    expect(ids(searchStoreProducts(list, "legging"))).toEqual(["b", "a", "d", "c"])
  })

  it("needs at least 2 characters and ignores empty / punctuation-only queries", () => {
    for (const q of ["", " ", "a", "!!", "  é "]) expect(searchStoreProducts(CATALOG, q), JSON.stringify(q)).toEqual([])
  })

  it("respects the limit and does not mutate the input", () => {
    const many = Array.from({ length: 30 }, (_, i) => p(String(i), `Produit numéro ${i}`))
    const snapshot = JSON.stringify(many)
    expect(searchStoreProducts(many, "produit", 5)).toHaveLength(5)
    expect(searchStoreProducts(many, "produit")).toHaveLength(8)
    expect(JSON.stringify(many)).toBe(snapshot)
  })

  it("caps an absurdly long query instead of choking on it", () => {
    expect(searchStoreProducts(CATALOG, "x".repeat(10_000))).toEqual([])
  })

  it("is stable: equal scores sort by name", () => {
    const list = [p("z", "Bougie rouge"), p("y", "Bougie bleue")]
    expect(ids(searchStoreProducts(list, "bougie"))).toEqual(["y", "z"])
  })

  it("works on CJK names", () => {
    expect(ids(searchStoreProducts([p("1", "便携游戏机"), p("2", "咖啡")], "游戏"))).toEqual(["1"])
  })
})
