import { describe, expect, it } from "vitest"

import { isBuyerPublicFastPath } from "@/lib/buyer-public-fast-path"

describe("isBuyerPublicFastPath", () => {
  it("matches buyer catalog routes", () => {
    expect(isBuyerPublicFastPath("/shops/browse")).toBe(true)
    expect(isBuyerPublicFastPath("/discover")).toBe(true)
    expect(isBuyerPublicFastPath("/cart")).toBe(true)
  })

  it("excludes merchant account area", () => {
    expect(isBuyerPublicFastPath("/marketplace/account")).toBe(false)
  })
})
