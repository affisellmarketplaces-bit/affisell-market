import { describe, expect, it } from "vitest"

import { resolveMerchantNavRole } from "@/lib/site-nav-merchant-role"

describe("resolveMerchantNavRole", () => {
  it("returns null on public home while session is loading (no notification poll flash)", () => {
    expect(
      resolveMerchantNavRole({
        pathname: "/",
        status: "loading",
        sessionRole: null,
        hintRole: "SUPPLIER",
      })
    ).toBeNull()
  })

  it("shows affiliate nav on home when session is authenticated", () => {
    expect(
      resolveMerchantNavRole({
        pathname: "/",
        status: "authenticated",
        sessionRole: "AFFILIATE",
        hintRole: null,
      })
    ).toBe("AFFILIATE")
  })

  it("prefers dashboard path over JWT on affiliate dashboard", () => {
    expect(
      resolveMerchantNavRole({
        pathname: "/dashboard/affiliate",
        status: "authenticated",
        sessionRole: "SUPPLIER",
        hintRole: null,
      })
    ).toBe("AFFILIATE")
  })
})
