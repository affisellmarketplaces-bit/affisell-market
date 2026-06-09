import { describe, expect, it } from "vitest"

import { rankListingSearchHits } from "@/lib/marketplace-search"
import { taxonomyBridgeTerms } from "@/lib/marketplace-search-taxonomy.server"

describe("taxonomyBridgeTerms", () => {
  it("bridges stylo (fr) to pen terms (en)", () => {
    const terms = taxonomyBridgeTerms("stylo").map((t) => t.toLowerCase())
    expect(terms.some((t) => t.startsWith("pen"))).toBe(true)
  })

  it("bridges pen (en) to stylo terms (fr)", () => {
    const terms = taxonomyBridgeTerms("pens").map((t) =>
      t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
    expect(terms.some((t) => t.startsWith("stylo"))).toBe(true)
  })

  it("returns nothing for short queries", () => {
    expect(taxonomyBridgeTerms("ab")).toEqual([])
  })
})

describe("rankListingSearchHits with bridge terms", () => {
  const penDoc = {
    listingId: "pen-set",
    title: "Ballpoint Pen Set 12 colors",
    description: "Smooth writing pens for school and office",
    categoryPath: "Fournitures de bureau > Instruments d'écriture > Stylos et crayons",
    isFeatured: false,
    conversions: 0,
    clicks: 0,
  }

  it("rescues an EN-titled product for a FR query via bridge terms", () => {
    // « stylo » alone ne matche pas le titre EN — le pont taxonomy doit le repêcher
    const hits = rankListingSearchHits([penDoc], "stylo", 5, ["Pens", "Pen", "Crayons"])
    expect(hits[0]?.listingId).toBe("pen-set")
  })

  it("does not rescue unrelated products", () => {
    const unrelated = {
      listingId: "sofa",
      title: "Canapé d'angle convertible",
      description: "Canapé 4 places",
      categoryPath: "Maison et jardin > Meubles > Canapés",
      isFeatured: false,
      conversions: 0,
      clicks: 0,
    }
    const hits = rankListingSearchHits([unrelated], "stylo", 5, ["Pens", "Pen"])
    expect(hits).toHaveLength(0)
  })
})
