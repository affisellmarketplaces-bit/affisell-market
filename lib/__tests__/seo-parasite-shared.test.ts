import { describe, expect, it } from "vitest"

import {
  buildParasiteProductPath,
  buildParasiteProductSegment,
  parseParasiteProductSegment,
  slugifyParasiteProductName,
} from "@/lib/seo-parasite-shared"

describe("seo-parasite-shared", () => {
  it("slugifies product names", () => {
    expect(slugifyParasiteProductName("Leggings Demo Try-On")).toBe("leggings-demo-try-on")
  })

  it("builds and parses product segment", () => {
    const productId = "cmp7n3gpq0004l7049gyv772x"
    const segment = buildParasiteProductSegment("Leggings Demo Try-On", productId)
    expect(segment).toBe(`leggings-demo-try-on-${productId}`)
    expect(parseParasiteProductSegment(segment)).toEqual({
      productSlug: "leggings-demo-try-on",
      productId,
    })
  })

  it("builds parasite path", () => {
    expect(
      buildParasiteProductPath("marc-boutique", "Leggings Demo Try-On", "cmp7n3gpq0004l7049gyv772x")
    ).toBe("/s/marc-boutique/leggings-demo-try-on-cmp7n3gpq0004l7049gyv772x")
  })
})
