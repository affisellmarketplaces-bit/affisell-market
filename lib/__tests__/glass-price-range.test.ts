import { describe, expect, it } from "vitest"

import { parsePriceFacet, parsePriceRangeCents } from "@/lib/marketplace-discovery-facets"

describe("glass price range facet", () => {
  it("parses free ranges in euros to listing-level cents", () => {
    expect(parsePriceRangeCents("40-300")).toEqual({ gte: 4000, lte: 30000 })
    expect(parsePriceRangeCents("300-40")).toEqual({ gte: 4000, lte: 30000 })
    expect(parsePriceRangeCents("under80")).toEqual({ lte: 8000 })
    expect(parsePriceRangeCents("over250")).toEqual({ gt: 25000 })
  })
  it("leaves the legacy buckets and garbage alone", () => {
    for (const legacy of ["under25", "25-100", "over100"]) {
      expect(parsePriceFacet(legacy)).not.toBeNull()
      expect(parsePriceRangeCents(legacy)).toBeNull()
    }
    expect(parsePriceRangeCents("abc")).toBeNull()
    expect(parsePriceRangeCents(null)).toBeNull()
    expect(parsePriceFacet("under300")).toBeNull()
  })
})
