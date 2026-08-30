import { describe, expect, it } from "vitest"

import { isMarketplaceListingPath } from "@/lib/affiliate-routes"
import { isMarketplaceHubPath } from "@/lib/marketplace-reserved-segments"

describe("marketplace reserved segments", () => {
  it("treats bestsellers as hub not PDP", () => {
    expect(isMarketplaceHubPath("/marketplace/bestsellers")).toBe(true)
    expect(isMarketplaceListingPath("/marketplace/bestsellers")).toBe(false)
  })

  it("still treats listing ids as PDP paths", () => {
    expect(isMarketplaceListingPath("/marketplace/clxyz123")).toBe(true)
    expect(isMarketplaceHubPath("/marketplace/clxyz123")).toBe(false)
  })
})
