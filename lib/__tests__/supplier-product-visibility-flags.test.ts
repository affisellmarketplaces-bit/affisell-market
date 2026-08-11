import { describe, expect, it } from "vitest"

import { isSupplierProductResellerVisible } from "@/lib/supplier-product-visibility-flags"

describe("isSupplierProductResellerVisible", () => {
  it("requires active and not draft", () => {
    expect(isSupplierProductResellerVisible({ active: true, isDraft: false })).toBe(true)
    expect(isSupplierProductResellerVisible({ active: true, isDraft: true })).toBe(false)
    expect(isSupplierProductResellerVisible({ active: false, isDraft: false })).toBe(false)
  })
})
