import { describe, expect, it } from "vitest"

import {
  isLightStorefrontHeader,
  resolveStorefrontTrustRailColors,
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
    expect((style as Record<string, string>)["--store-header-accent-glow"]).toContain("#a78bfa")
  })

  it("uses light trust rail background and black label default", () => {
    const style = storefrontHeaderTrustRailStyle("#2563eb", "#06b6d4")
    expect(style.background).toContain("white")
    expect(storefrontTrustRailTextColor()).toBe("#18181b")
    expect(storefrontTrustRailTextColor("#ffffff")).toBe("#ffffff")
  })

  it("forces readable trust rail text when merchant picks low-contrast accent", () => {
    const colors = resolveStorefrontTrustRailColors("#18181b", "#06b6d4", "#06b6d4")
    expect(colors.text).toBe("#0f172a")
    expect(colors.icon).toBe("#06b6d4")
    expect(colors.aurora).toContain("gradient")
    expect(colors.glow).toContain("color-mix")
  })

  it("keeps dark custom trust rail text when contrast is sufficient", () => {
    const colors = resolveStorefrontTrustRailColors("#18181b", "#7c3aed", "#18181b")
    expect(colors.text).toBe("#18181b")
  })
})
