import { describe, expect, it } from "vitest"

import {
  loginAffiliatePath,
  loginCustomerPath,
  loginSelectorPath,
  resolvePostLoginRedirect,
  resolvePublicSignInHref,
  shopBuyerLoginPath,
} from "@/lib/login-redirect"

describe("login-redirect", () => {
  it("preserves callback in affiliate login path", () => {
    expect(loginAffiliatePath("/dashboard/affiliate")).toBe(
      "/login/affiliate?callbackUrl=%2Fdashboard%2Faffiliate"
    )
  })

  it("preserves callback in selector path", () => {
    expect(loginSelectorPath("/dashboard/affiliate")).toContain("callbackUrl=")
  })

  it("sends affiliate to dashboard or callback", () => {
    expect(resolvePostLoginRedirect("AFFILIATE", "/dashboard/affiliate/brand-studio")).toBe(
      "/dashboard/affiliate/brand-studio"
    )
    expect(resolvePostLoginRedirect("AFFILIATE", null)).toBe("/dashboard/affiliate")
  })

  it("sends supplier away from affiliate callback", () => {
    expect(resolvePostLoginRedirect("SUPPLIER", "/dashboard/affiliate")).toBe("/dashboard/supplier")
  })

  it("routes public sign-in to customer portal on buyer surfaces", () => {
    expect(resolvePublicSignInHref("/")).toBe(loginCustomerPath("/marketplace/account/orders"))
    expect(resolvePublicSignInHref("/marketplace")).toBe(loginCustomerPath("/marketplace/account/orders"))
    expect(resolvePublicSignInHref("/cart")).toContain("/login/customer")
  })

  it("routes shop pages to contextual shop login", () => {
    expect(resolvePublicSignInHref("/shops/marie")).toBe(
      shopBuyerLoginPath("marie", "/shops/marie")
    )
  })

  it("routes pro surfaces to merchant login", () => {
    expect(resolvePublicSignInHref("/dashboard/affiliate")).toBe(
      loginAffiliatePath("/dashboard/affiliate")
    )
    expect(resolvePublicSignInHref("/creators")).toBe(loginAffiliatePath("/creators"))
    expect(resolvePublicSignInHref("/login")).toBe(loginSelectorPath("/login"))
  })
})
