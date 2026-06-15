import { describe, expect, it } from "vitest"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

describe("marketplaceCatalogHref", () => {
  it("adds shipsTo and explorer hash on home path", () => {
    expect(marketplaceCatalogHref("/", { shipsTo: "JP" })).toBe("/?shipsTo=jp#explorer")
  })
})
