import { describe, expect, it } from "vitest"

import {
  loginAffiliatePath,
  loginSelectorPath,
  resolvePostLoginRedirect,
} from "@/lib/login-redirect"
import { inferLoginPortal } from "@/lib/auth-login-portal"
import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"

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

  it("sends admin to their callback or the default admin landing", () => {
    expect(resolvePostLoginRedirect("ADMIN", "/admin/orders")).toBe("/admin/orders")
    expect(resolvePostLoginRedirect("ADMIN", null)).toBe("/admin/auto-fulfill")
  })
})

describe("inferLoginPortal — admin", () => {
  it("recognizes /login/admin and any /admin/* callback as the ADMIN portal", () => {
    expect(inferLoginPortal("/login/admin")).toBe("ADMIN")
    expect(inferLoginPortal("/admin/auto-fulfill")).toBe("ADMIN")
    expect(inferLoginPortal("/admin/orders")).toBe("ADMIN")
  })

  it("does not misclassify unrelated callbacks as ADMIN", () => {
    expect(inferLoginPortal("/dashboard/supplier")).not.toBe("ADMIN")
    expect(inferLoginPortal("/shops/browse")).not.toBe("ADMIN")
  })
})

describe("credentialsSignInErrorMessage — non_admin_on_admin_portal", () => {
  it("translates the admin-portal rejection code", () => {
    const translate = (key: string) => `t(${key})`
    expect(credentialsSignInErrorMessage("non_admin_on_admin_portal", undefined, translate)).toBe(
      "t(portal.errors.non_admin_on_admin_portal)"
    )
  })
})
