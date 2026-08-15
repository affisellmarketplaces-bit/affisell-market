import { describe, expect, it } from "vitest"

import {
  extractStoreInitials,
  inferNameBadgeStyle,
  inferNicheFromCatalogBlob,
  inferTrustRailTextColor,
  isBrandStudioGenerateField,
} from "@/lib/storefront-brand-field-generate-shared"
import { buildInitialsLogoSvg } from "@/lib/storefront-brand-logo.server"

describe("storefront-brand-field-generate-shared", () => {
  it("validates generate field ids", () => {
    expect(isBrandStudioGenerateField("logo")).toBe(true)
    expect(isBrandStudioGenerateField("invalid")).toBe(false)
  })

  it("infers niche from catalog blob", () => {
    expect(inferNicheFromCatalogBlob("usb gadget smart home")).toBe("tech")
    expect(inferNicheFromCatalogBlob("skincare serum glow")).toBe("beauty")
  })

  it("picks readable trust rail on light vs dark headers", () => {
    expect(inferTrustRailTextColor("#f8fafc")).toBe("#18181b")
    expect(inferTrustRailTextColor("#18181b")).toBe("#f8fafc")
  })

  it("maps surface to name badge", () => {
    expect(inferNameBadgeStyle({ surface: "light", presetId: "nebula-aurora" })).toBe("classic")
    expect(inferNameBadgeStyle({ surface: "dark", presetId: "midnight-orbit" })).toBe("neon-slab")
  })

  it("extracts store initials", () => {
    expect(extractStoreInitials("Nova Tech")).toBe("NT")
    expect(extractStoreInitials("Glow")).toBe("GL")
    expect(extractStoreInitials("")).toBe("AS")
  })
})

describe("storefront-brand-logo.server", () => {
  it("builds svg logo buffer", () => {
    const buf = buildInitialsLogoSvg({
      storeName: "Nova Tech",
      primary: "#5b21b6",
      accent: "#06b6d4",
    })
    const svg = buf.toString("utf-8")
    expect(svg).toContain("NT")
    expect(svg).toContain("<svg")
  })
})
