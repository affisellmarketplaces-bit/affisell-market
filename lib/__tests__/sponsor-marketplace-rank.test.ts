import { describe, expect, it } from "vitest"

import {
  isSponsorActiveInContext,
  sortListingsBySponsorBoost,
  type SponsorBoostMap,
} from "@/lib/sponsor/sponsor-marketplace-rank"

describe("sponsor placement targeting", () => {
  // Regression: "Search boost" (cheapest, 1.0x multiplier) and "Home spotlight" (priciest, 1.5x)
  // used to buy the exact same global ranking lift everywhere — a campaign's boost must now only
  // apply in the context (home/category/search) the payer actually bought.
  const boostMap: SponsorBoostMap = new Map([
    ["home-sku", { boostScore: 900, placement: "HOME_SPOTLIGHT" }],
    ["search-sku", { boostScore: 500, placement: "SEARCH_BOOST" }],
    ["category-sku", { boostScore: 600, placement: "CATEGORY_TOP" }],
  ])
  const rows = [{ id: "unboosted" }, { id: "search-sku" }, { id: "home-sku" }, { id: "category-sku" }]

  it("only ranks the HOME_SPOTLIGHT listing first on the home context", () => {
    const ranked = sortListingsBySponsorBoost(rows, boostMap, "HOME")
    expect(ranked[0]!.id).toBe("home-sku")
    expect(ranked.slice(1).map((r) => r.id).sort()).toEqual(
      ["unboosted", "search-sku", "category-sku"].sort()
    )
  })

  it("only ranks the SEARCH_BOOST listing first on the search context", () => {
    const ranked = sortListingsBySponsorBoost(rows, boostMap, "SEARCH")
    expect(ranked[0]!.id).toBe("search-sku")
  })

  it("only ranks the CATEGORY_TOP listing first on the category context", () => {
    const ranked = sortListingsBySponsorBoost(rows, boostMap, "CATEGORY")
    expect(ranked[0]!.id).toBe("category-sku")
  })

  it("badges a listing as sponsored only in its paid-for context", () => {
    const homeBoost = boostMap.get("home-sku")
    expect(isSponsorActiveInContext(homeBoost, "HOME")).toBe(true)
    expect(isSponsorActiveInContext(homeBoost, "SEARCH")).toBe(false)
    expect(isSponsorActiveInContext(homeBoost, "CATEGORY")).toBe(false)
    expect(isSponsorActiveInContext(undefined, "HOME")).toBe(false)
  })
})
