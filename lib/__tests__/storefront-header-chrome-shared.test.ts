import { describe, expect, it } from "vitest"

import {
  isLightStorefrontHeader,
  storefrontHeaderLuminance,
  storefrontHeaderShellStyle,
  storefrontHeaderTrustRailStyle,
  storefrontTrustRailTextColor,
} from "@/lib/storefront-header-chrome-shared"

describe("storefront-header-chrome-shared", () => {
  it("detects light vs dark headers from luminance", () => {
    expect(isLightStorefrontHeader("#18181b")).toBe(false)
    expect(isLightStorefrontHeader("#f8fafc")).toBe(true)
    expect(storefrontHeaderLuminance("#ffffff")).toBeGreaterThan(0.9)
  })

  it("builds gradient shell style from merchant primary", () => {
    const style = storefrontHeaderShellStyle("#4c1d95", "#a78bfa")
    expect(style.background).toContain("#4c1d95")
    expect(style["--store-header-accent-glow"]).toContain("#a78bfa")
  })

  it("uses light trust rail background and black label default", () => {
    const style = storefrontHeaderTrustRailStyle("#2563eb")
    expect(style.background).toContain("white")
    expect(storefrontTrustRailTextColor()).toBe("#18181b")
    expect(storefrontTrustRailTextColor("#ffffff")).toBe("#ffffff")
  })
})
