import { describe, expect, it } from "vitest"

import {
  buildSkuCombinations,
  generateSkuTableRows,
  parseCommaList,
  suggestVariantSku,
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
