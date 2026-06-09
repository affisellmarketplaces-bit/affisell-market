import { describe, expect, it } from "vitest"

import {
  MARKETPLACE_QUERY_RESERVED,
  parseMarketplaceAttributeFilters,
} from "@/lib/marketplace-attribute-filters"

describe("parseMarketplaceAttributeFilters", () => {
  it("skips reserved and custom-column keys", () => {
    const sp = new URLSearchParams(
      "category=cat1&subcategory=sub1&q=phone&cc_color=red&brand=Nike&shipsFrom=FR"
    )
    expect(parseMarketplaceAttributeFilters(sp)).toEqual({ brand: "Nike" })
  })

  it("respects allowedKeys when provided", () => {
    const sp = new URLSearchParams("brand=Nike&size=M")
    expect(parseMarketplaceAttributeFilters(sp, new Set(["brand"]))).toEqual({ brand: "Nike" })
  })

  it("reserved set matches marketplace browse params", () => {
    expect(MARKETPLACE_QUERY_RESERVED.has("category")).toBe(true)
    expect(MARKETPLACE_QUERY_RESERVED.has("q")).toBe(true)
    expect(MARKETPLACE_QUERY_RESERVED.has("brand")).toBe(false)
  })

  it("never treats lite/offer transport flags as product attribute filters", () => {
    // Régression : `lite=1` interprété comme filtre d'attribut → catalogue vide
    const filters = parseMarketplaceAttributeFilters(
      new URLSearchParams("category=cat123&lite=1&offer=refurbished&q=stylo&price=10-20")
    )
    expect(filters).toEqual({})
  })

  it("keeps genuine attribute filters alongside transport flags", () => {
    const filters = parseMarketplaceAttributeFilters(
      new URLSearchParams("category=cat123&lite=1&couleur=rouge")
    )
    expect(filters).toEqual({ couleur: "rouge" })
  })
})
