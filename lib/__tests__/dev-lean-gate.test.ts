import { describe, expect, it } from "vitest"

import { isMerchantLeanBlockedPath } from "@/lib/dev-lean-gate"

describe("isMerchantLeanBlockedPath", () => {
  it("blocks merchant dashboards and APIs", () => {
    expect(isMerchantLeanBlockedPath("/dashboard/supplier")).toBe(true)
    expect(isMerchantLeanBlockedPath("/api/supplier/notifications")).toBe(true)
    expect(isMerchantLeanBlockedPath("/api/affiliate/bootstrap")).toBe(true)
  })

  it("allows buyer routes", () => {
    expect(isMerchantLeanBlockedPath("/")).toBe(false)
    expect(isMerchantLeanBlockedPath("/shops/browse")).toBe(false)
    expect(isMerchantLeanBlockedPath("/api/cart")).toBe(false)
  })
})
