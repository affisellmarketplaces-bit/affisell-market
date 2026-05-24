import { describe, expect, it } from "vitest"

import { shopperCategoryEyebrow, shopperVisibleTags } from "@/lib/product-shopper-tags"

describe("product-shopper-tags", () => {
  it("hides internal import tags from shoppers", () => {
    expect(shopperVisibleTags(["imported", "waterproof"])).toEqual(["waterproof"])
    expect(shopperCategoryEyebrow([], ["imported"])).toBeNull()
    expect(shopperCategoryEyebrow(["Electronics"], ["imported"])).toBe("Electronics")
  })
})
