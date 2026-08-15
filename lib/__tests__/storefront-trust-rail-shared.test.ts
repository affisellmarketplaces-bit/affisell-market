import { describe, expect, it } from "vitest"

import { resolveStorefrontTrustRailColors } from "@/lib/storefront-header-chrome-shared"
import { trustRailChipPalette } from "@/lib/storefront-trust-rail-shared"

describe("storefront-trust-rail-shared", () => {
  it("builds orbit chip palette from merchant colors", () => {
    const colors = resolveStorefrontTrustRailColors("#18181b", "#7c3aed")
    const palette = trustRailChipPalette("orbit", colors)
    expect(palette.icon).toBe("#7c3aed")
    expect(palette.bg).toContain("gradient")
  })

  it("builds distinct secure and compliance palettes", () => {
    const colors = resolveStorefrontTrustRailColors("#18181b", "#06b6d4")
    const secure = trustRailChipPalette("secure", colors)
    const compliance = trustRailChipPalette("compliance", colors)
    expect(secure.icon).not.toBe(compliance.icon)
  })
})
