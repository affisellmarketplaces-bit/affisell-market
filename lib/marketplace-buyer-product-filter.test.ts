import { describe, expect, it } from "vitest"

import {
  INTERNAL_TEST_PRODUCT_NAMES,
  isInternalTestProductId,
  isInternalTestProductName,
} from "@/lib/marketplace-buyer-product-filter"

describe("marketplace-buyer-product-filter", () => {
  it("recognizes internal test product names", () => {
    for (const name of INTERNAL_TEST_PRODUCT_NAMES) {
      expect(isInternalTestProductName(name)).toBe(true)
      expect(isInternalTestProductName(name.toUpperCase())).toBe(true)
    }
    expect(isInternalTestProductName("Real Product")).toBe(false)
  })

  it("recognizes pinned internal test ids", () => {
    expect(isInternalTestProductId("test_product_3way")).toBe(true)
    expect(isInternalTestProductId("cmpiddd890003thlps6tp")).toBe(true)
    expect(isInternalTestProductId("other")).toBe(false)
  })
})
