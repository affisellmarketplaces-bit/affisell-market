import { describe, expect, it } from "vitest"

import {
  catalogHexForColorName,
  normalizeColorKey,
  resolveColorSwatchMeta,
} from "@/lib/color-name-hex"
import { buildMarketplaceColorMeta } from "@/lib/marketplace-color-meta"
import { findVariantRowByOptionName } from "@/lib/product-variants"

describe("color-name-hex", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalizeColorKey("Gris Foncé")).toBe("gris fonce")
    expect(normalizeColorKey("Z-gris")).toBe("z gris")
  })

  it("resolves French supplier color names", () => {
    expect(resolveColorSwatchMeta("Noir").hex).toBe("#000000")
    expect(resolveColorSwatchMeta("Kaki").hex).toBe("#78866B")
    expect(resolveColorSwatchMeta("Gris Foncé").hex).toBe("#374151")
    expect(resolveColorSwatchMeta("Rouge Foncé").hex).toBe("#991B1B")
    expect(resolveColorSwatchMeta("Violet de Raisin").hex).toBe("#6B2D5C")
    expect(resolveColorSwatchMeta("Z-gris").hex).toBe("#71717A")
  })

  it("prefers stored hex when valid", () => {
    expect(resolveColorSwatchMeta("Custom", "#112233").hex).toBe("#112233")
  })

  it("catalogHexForColorName stays compatible", () => {
    expect(catalogHexForColorName("Noir")).toBe("#000000")
  })
})

describe("buildMarketplaceColorMeta", () => {
  it("returns swatch meta for every color name", () => {
    const rows = buildMarketplaceColorMeta(["Noir", "Kaki"], [])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.meta.hex).toBe("#000000")
    expect(rows[1]?.meta.hex).toBe("#78866B")
  })
})

describe("findVariantRowByOptionName color prefix", () => {
  const variants = {
    variantRows: [
      { id: "1", name: "Noir / S", sku: "", priceCents: 1810, stock: 5, commission: 25, sales: 0 },
      { id: "2", name: "Noir / M", sku: "", priceCents: 1810, stock: 8, commission: 25, sales: 0 },
      { id: "3", name: "Kaki", sku: "", priceCents: 2300, stock: 3, commission: 30, sales: 0 },
    ],
  }

  it("matches primary color against composite SKU names", () => {
    const row = findVariantRowByOptionName(variants, "Noir")
    expect(row?.name).toMatch(/^Noir/)
    expect(row?.stock).toBeGreaterThan(0)
  })
})
