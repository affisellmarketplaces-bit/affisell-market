import { describe, expect, it } from "vitest"

import {
  loginAffiliatePath,
  loginSelectorPath,
  resolvePostLoginRedirect,
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
})
