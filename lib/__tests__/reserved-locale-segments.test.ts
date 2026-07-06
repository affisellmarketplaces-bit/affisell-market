import { describe, expect, it } from "vitest"

import { isStaticAppPathname, RESERVED_LOCALE_SEGMENTS, staticAppRewriteTarget } from "@/lib/reserved-locale-segments"

describe("isStaticAppPathname", () => {
  it("treats app routes as static, not locales", () => {
    expect(isStaticAppPathname("/agent")).toBe(true)
    expect(isStaticAppPathname("/agents/apply")).toBe(true)
    expect(isStaticAppPathname("/contact")).toBe(true)
    expect(isStaticAppPathname("/accessibilite")).toBe(true)
    expect(isStaticAppPathname("/conditions-affilie")).toBe(true)
    expect(isStaticAppPathname("/conditions-fournisseur")).toBe(true)
    expect(isStaticAppPathname("/cookies")).toBe(true)
    expect(isStaticAppPathname("/reaccept-terms")).toBe(true)
    expect(isStaticAppPathname("/legal/mentions")).toBe(true)
    expect(isStaticAppPathname("/about")).toBe(true)
    expect(isStaticAppPathname("/blog")).toBe(true)
    expect(isStaticAppPathname("/press")).toBe(true)
    expect(isStaticAppPathname("/protected-checkout")).toBe(true)
    expect(isStaticAppPathname("/help/faq")).toBe(true)
    expect(isStaticAppPathname("/sell/affiliate-program")).toBe(true)
    expect(isStaticAppPathname("/sell/become-supplier")).toBe(true)
    expect(isStaticAppPathname("/legal/terms-of-service")).toBe(true)
    expect(isStaticAppPathname("/dashboard/supplier")).toBe(true)
    expect(isStaticAppPathname("/invite/supplier/INV-ABC")).toBe(true)
    expect(isStaticAppPathname("/invite/affiliate/IAF-ABC")).toBe(true)
    expect(isStaticAppPathname("/demo")).toBe(true)
    expect(isStaticAppPathname("/demo/supplier")).toBe(true)
    expect(isStaticAppPathname("/e2e/ltv/badge")).toBe(true)
    expect(isStaticAppPathname("/fr/demo")).toBe(true)
    expect(isStaticAppPathname("/en/demo/affiliate")).toBe(true)
  })

  it("does not treat locale codes as static app paths", () => {
    expect(isStaticAppPathname("/fr")).toBe(false)
    expect(isStaticAppPathname("/en")).toBe(false)
    expect(RESERVED_LOCALE_SEGMENTS.has("fr")).toBe(false)
    expect(RESERVED_LOCALE_SEGMENTS.has("de")).toBe(false)
    expect(RESERVED_LOCALE_SEGMENTS.has("es")).toBe(false)
  })

  it("rewrites locale-prefixed static routes to bare app paths", () => {
    expect(staticAppRewriteTarget("/fr/login")).toBe("/login")
    expect(staticAppRewriteTarget("/fr/accessibilite")).toBe("/accessibilite")
    expect(staticAppRewriteTarget("/fr/login/customer")).toBe("/login/customer")
    expect(staticAppRewriteTarget("/en/signup/customer")).toBe("/signup/customer")
    expect(staticAppRewriteTarget("/login")).toBeNull()
    expect(staticAppRewriteTarget("/fr")).toBeNull()
    expect(staticAppRewriteTarget("/fr/creators")).toBeNull()
  })
})
