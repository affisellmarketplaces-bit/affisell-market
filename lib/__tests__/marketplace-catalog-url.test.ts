import { describe, expect, it } from "vitest"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

describe("marketplaceCatalogHref", () => {
  it("adds shipsTo and explorer hash on home path", () => {
    expect(marketplaceCatalogHref("/", { shipsTo: "JP" })).toBe("/?shipsTo=jp#explorer")
  })

  it("builds standalone browse path without explorer hash", () => {
    expect(marketplaceCatalogHref("/shops/browse", { q: "tv", shipsTo: "FR" })).toBe(
      "/shops/browse?q=tv&shipsTo=fr"
    )
  })
})
