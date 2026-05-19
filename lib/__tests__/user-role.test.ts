import { describe, expect, it } from "vitest"

import { canShowBusinessProductData, resolveUserRole } from "@/lib/user-role"

describe("resolveUserRole", () => {
  it("shop paths force customer", () => {
    expect(resolveUserRole({ sessionRole: "AFFILIATE", pathname: "/shop/fitness-coach" })).toBe(
      "customer"
    )
    expect(
      resolveUserRole({
        sessionRole: "SUPPLIER",
        pathname: "/shop/fitness-coach/product/abc",
      })
    ).toBe("customer")
    expect(resolveUserRole({ pathname: "/shops" })).toBe("customer")
  })

  it("session affiliate on marketplace stays affiliate", () => {
    expect(resolveUserRole({ sessionRole: "AFFILIATE", pathname: "/marketplace" })).toBe(
      "affiliate"
    )
  })

  it("unauthenticated returns null", () => {
    expect(resolveUserRole({ pathname: "/marketplace" })).toBe(null)
  })
})

describe("canShowBusinessProductData", () => {
  it("only affiliate and supplier", () => {
    expect(canShowBusinessProductData("affiliate")).toBe(true)
    expect(canShowBusinessProductData("supplier")).toBe(true)
    expect(canShowBusinessProductData("customer")).toBe(false)
    expect(canShowBusinessProductData(null)).toBe(false)
  })
})
