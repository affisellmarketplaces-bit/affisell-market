import { describe, expect, it } from "vitest"

import {
  buildSkuCombinations,
  fillMissingVariantSkus,
  generateSkuTableRows,
  parseCommaList,
  suggestVariantSku,
  suggestVariantSkuFromRow,
  validateSupplierSkuTableRows,
} from "@/lib/supplier-sku-builder"

describe("supplier-sku-builder", () => {
  it("parses comma-separated colors and sizes", () => {
    expect(parseCommaList("Noir, Rouge, Bleu")).toEqual(["Noir", "Rouge", "Bleu"])
    expect(parseCommaList("S, M, L, XL")).toEqual(["S", "M", "L", "XL"])
  })

  it("builds 3x4 combinations", () => {
    const combos = buildSkuCombinations(["Noir", "Rouge", "Bleu"], ["S", "M", "L", "XL"])
    expect(combos).toHaveLength(12)
  })

  it("generates suggested SKU", () => {
    expect(suggestVariantSku("TS", "Noir", "S")).toBe("TS-NOIR-S")
  })

  it("generateSkuTableRows creates rows with defaults", () => {
    const rows = generateSkuTableRows({
      colorsText: "Noir, Rouge",
      sizesText: "S, M",
      skuPrefix: "BON",
      baseSupplierPrice: 9.9,
      defaultCommission: 10,
    })
    expect(rows).toHaveLength(4)
    expect(rows[0]?.sku).toBe("BON-NOIR-S")
  })

  it("suggestVariantSkuFromRow keeps distinct codes for similar color labels", () => {
    const a = suggestVariantSkuFromRow("PRD", "KJY-P02-with Remote", null)
    const b = suggestVariantSkuFromRow("PRD", "KJY-P02S-with Light", null)
    expect(a).not.toBe(b)
  })

  it("fillMissingVariantSkus fills empty rows without overwriting", () => {
    const rows = [
      {
        id: "1",
        color: "KJY-P02-with Remote",
        size: null,
        sku: null,
        supplierPrice: 35.79,
        stock: 300,
        commissionRate: 14,
      },
      {
        id: "2",
        color: "KJY-P02S-with Light",
        size: null,
        sku: "MANUAL-SKU",
        supplierPrice: 42.79,
        stock: 300,
        commissionRate: 14,
      },
    ]
    const { rows: next, filled, previews } = fillMissingVariantSkus(rows, "PRD")
    expect(filled).toBe(1)
    expect(next[0]?.sku?.trim()).toBeTruthy()
    expect(next[1]?.sku).toBe("MANUAL-SKU")
    expect(previews).toHaveLength(1)
    expect(new Set(next.map((r) => r.sku?.toLowerCase())).size).toBe(2)
  })

  it("flags duplicate SKU in validation", () => {
    const issues = validateSupplierSkuTableRows([
      {
        id: "1",
        color: "Noir",
        size: "S",
        sku: "DUP",
        supplierPrice: 10,
        stock: 1,
        commissionRate: 10,
      },
      {
        id: "2",
        color: "Rouge",
        size: "M",
        sku: "DUP",
        supplierPrice: 10,
        stock: 1,
        commissionRate: 10,
      },
    ])
    expect(issues.some((i) => i.message.includes("dupliqué"))).toBe(true)
  })
})
