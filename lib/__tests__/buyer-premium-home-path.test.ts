import { describe, expect, it } from "vitest"

import { isBuyerPremiumHomePath } from "@/lib/buyer-premium-home-path"

describe("isBuyerPremiumHomePath", () => {
  it("matches / and /fr", () => {
    expect(isBuyerPremiumHomePath("/")).toBe(true)
    expect(isBuyerPremiumHomePath("/fr")).toBe(true)
  })

  it("rejects marketplace and other routes", () => {
    expect(isBuyerPremiumHomePath("/shops/browse")).toBe(false)
    expect(isBuyerPremiumHomePath("/marketplace")).toBe(false)
    expect(isBuyerPremiumHomePath("/discover")).toBe(false)
    expect(isBuyerPremiumHomePath(null)).toBe(false)
  })
})
