import { describe, expect, it } from "vitest"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

describe("marketplaceCatalogHref", () => {
  it("builds home explorer search URL", () => {
    expect(marketplaceCatalogHref("/", { q: "chaussures" })).toBe("/?q=chaussures#explorer")
  })

  it("builds home explorer without query", () => {
    expect(marketplaceCatalogHref("/")).toBe("/#explorer")
  })

  it("keeps shops browse path without hash", () => {
    expect(marketplaceCatalogHref("/shops/browse", { q: "robe" })).toBe("/shops/browse?q=robe")
  })
})
