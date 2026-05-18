import { describe, expect, it } from "vitest"

import {
  marginEur,
  normalizeProductVariantRows,
  parseProductVariantsFromBody,
  productVariantInputSchema,
} from "@/lib/product-variant-sku"

describe("product-variant-sku", () => {
  it("validates supplier and public prices", () => {
    const ok = productVariantInputSchema.safeParse({
      color: "Noir",
      supplierPrice: 10,
      publicPrice: 25,
      stock: 5,
    })
    expect(ok.success).toBe(true)

    const bad = productVariantInputSchema.safeParse({
      color: "Noir",
      supplierPrice: 30,
      publicPrice: 20,
      stock: 1,
    })
    expect(bad.success).toBe(false)
  })

  it("rejects color with + or comma", () => {
    const bad = productVariantInputSchema.safeParse({
      color: "Noir+Rouge",
      supplierPrice: 10,
      publicPrice: 20,
      stock: 1,
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toMatch(/Pas de \+ ou virgule/)
    }
  })

  it("computes margin", () => {
    expect(marginEur(10, 24.99)).toBe(14.99)
  })

  it("requires rows when hasVariants", () => {
    const r = parseProductVariantsFromBody({ hasVariants: true, variants: [] })
    expect("error" in r && r.error).toMatch(/Au moins une variante/)
  })

  it("ignores JSON merchandising variants object (not SKU array)", () => {
    const r = parseProductVariantsFromBody({
      variants: { variantRows: [{ name: "Noir / M", stock: 1 }] },
    })
    expect("error" in r).toBe(false)
    if (!("error" in r)) {
      expect(r.hasVariants).toBe(false)
      expect(r.variants).toEqual([])
    }
  })

  it("parses Bonnet Noir/Rouge x S/M (4 SKUs)", () => {
    const body = {
      hasVariants: true,
      variants: [
        { color: "Noir", size: "S", sku: "BON-NOI-S", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
        { color: "Noir", size: "M", sku: "BON-NOI-M", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
        { color: "Rouge", size: "S", sku: "BON-ROU-S", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
        { color: "Rouge", size: "M", sku: "BON-ROU-M", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
      ],
    }
    const r = parseProductVariantsFromBody(body)
    expect("error" in r).toBe(false)
    if (!("error" in r)) {
      expect(r.variants).toHaveLength(4)
    }
  })

  it("returns explicit duplicate combo error", () => {
    const r = normalizeProductVariantRows([
      { color: "Noir", size: "M", sku: "A", supplierPrice: 10, publicPrice: 20, stock: 1 },
      { color: "Noir", size: "M", sku: "B", supplierPrice: 10, publicPrice: 20, stock: 2 },
    ])
    expect("error" in r).toBe(true)
    if ("error" in r) {
      expect(r.error).toMatch(/dupliqué ligne 1/i)
    }
  })

  it("returns 400-style message for Noir+Rouge via parseProductVariantsFromBody", () => {
    const r = parseProductVariantsFromBody({
      hasVariants: true,
      variants: [{ color: "Noir+Rouge", supplierPrice: 9.9, publicPrice: 19.9, stock: 1 }],
    })
    expect("error" in r).toBe(true)
    if ("error" in r) {
      expect(r.error.toLowerCase()).toMatch(/couleur|noir\+rouge|pas de/)
    }
  })
})
