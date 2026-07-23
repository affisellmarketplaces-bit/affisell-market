import { describe, expect, it } from "vitest"

import { isResellerStoresNavContext } from "@/lib/public-nav-stores-context"

describe("isResellerStoresNavContext", () => {
  it("is false for guests and customers on buyer routes", () => {
    expect(isResellerStoresNavContext(null, "/")).toBe(false)
    expect(isResellerStoresNavContext("CUSTOMER", "/shops")).toBe(false)
    expect(isResellerStoresNavContext(undefined, "/marketplace")).toBe(false)
  })

  it("is true for affiliate/reseller sessions", () => {
    expect(isResellerStoresNavContext("AFFILIATE", "/")).toBe(true)
    expect(isResellerStoresNavContext("reseller", "/shops")).toBe(true)
  })

  it("is true on B2B acquisition paths even when logged out", () => {
    expect(isResellerStoresNavContext(null, "/become-reseller")).toBe(true)
    expect(isResellerStoresNavContext(null, "/signup/affiliate")).toBe(true)
    expect(isResellerStoresNavContext(null, "/dashboard/reseller")).toBe(true)
  })
})
