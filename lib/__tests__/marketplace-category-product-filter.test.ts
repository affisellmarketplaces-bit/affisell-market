import { describe, expect, it } from "vitest"

import { significantTokens } from "@/lib/marketplace-category-product-filter"

describe("marketplace category product filter tokens", () => {
  it("extracts tokens from aisle names for text fallback", () => {
    const tokens = significantTokens(["Descalers & Appliance Care", "Cleaning Supplies"])
    expect(tokens).toContain("descalers")
    expect(tokens).toContain("cleaning")
    expect(tokens).toContain("supplies")
  })
})
