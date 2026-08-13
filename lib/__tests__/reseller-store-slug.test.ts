import { describe, expect, it } from "vitest"

import { buildResellerBoutiquePath, slugFromResellerStoreName } from "@/lib/boutique/reseller-store-slug"

describe("slugFromResellerStoreName", () => {
  it("normalizes accents and spaces", () => {
    expect(slugFromResellerStoreName("Ma Première Boutique!")).toBe("ma-premi-re-boutique")
  })

  it("rejects empty after normalization", () => {
    expect(slugFromResellerStoreName("---")).toBe("")
  })
})

describe("buildResellerBoutiquePath", () => {
  it("builds path with optional listing id", () => {
    expect(buildResellerBoutiquePath("test-shop")).toBe("/boutique/test-shop")
    expect(buildResellerBoutiquePath("test-shop", "cmp123")).toBe(
      "/boutique/test-shop?productId=cmp123"
    )
  })
})
