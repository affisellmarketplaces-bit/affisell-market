import { describe, expect, it } from "vitest"

import { resolveSupplierProductRemoveAction } from "@/lib/supplier-product-remove-shared"

describe("resolveSupplierProductRemoveAction", () => {
  it("blocks delete when product has orders", () => {
    expect(
      resolveSupplierProductRemoveAction({
        isDraft: false,
        active: true,
        orderCount: 2,
        listedAffiliateCount: 0,
      })
    ).toBe("blocked_orders")
  })

  it("requires recall when partners list live on storefront", () => {
    expect(
      resolveSupplierProductRemoveAction({
        isDraft: false,
        active: true,
        orderCount: 0,
        listedAffiliateCount: 3,
      })
    ).toBe("recall")
  })

  it("allows delete for draft without partner listings", () => {
    expect(
      resolveSupplierProductRemoveAction({
        isDraft: true,
        active: false,
        orderCount: 0,
        listedAffiliateCount: 0,
      })
    ).toBe("delete")
  })

  it("allows delete for live product with zero partner storefronts", () => {
    expect(
      resolveSupplierProductRemoveAction({
        isDraft: false,
        active: true,
        orderCount: 0,
        listedAffiliateCount: 0,
      })
    ).toBe("delete")
  })

  it("returns none for already paused product with no listings", () => {
    expect(
      resolveSupplierProductRemoveAction({
        isDraft: false,
        active: false,
        orderCount: 0,
        listedAffiliateCount: 0,
      })
    ).toBe("none")
  })
})
