import { describe, expect, it } from "vitest"

import { parseSupplierDecimalInput } from "@/lib/supplier-decimal-input"
import {
  buildListingMirrorIndexes,
  mergeSkuTableRowFromListingMirror,
  skuTableRowFromApiVariant,
} from "@/lib/supplier-sku-builder"

describe("parseSupplierDecimalInput", () => {
  it("parses comma decimals", () => {
    expect(parseSupplierDecimalInput("299,90")).toBe(299.9)
    expect(parseSupplierDecimalInput("197,8")).toBe(197.8)
  })

  it("returns null for empty", () => {
    expect(parseSupplierDecimalInput("")).toBeNull()
    expect(parseSupplierDecimalInput("   ")).toBeNull()
  })
})

describe("mergeSkuTableRowFromListingMirror", () => {
  it("restores compare-at from listing mirror", () => {
    const api = skuTableRowFromApiVariant({
      id: "v1",
      color: "Rouge",
      size: "M",
      sku: "PRD-R-M",
      supplierPrice: 197.8,
      stock: 10,
      commissionRate: 20,
    })
    const indexes = buildListingMirrorIndexes([
      {
        id: "v1",
        name: "Rouge / M",
        sku: "PRD-R-M",
        priceCents: 19780,
        stock: 10,
        commission: 20,
        sales: 0,
        compareAtCents: 29990,
      },
    ])
    const mirror = indexes.byId.get("v1")
    const merged = mergeSkuTableRowFromListingMirror(api, mirror)
    expect(merged.compareAtEur).toBe(299.9)
  })
})
