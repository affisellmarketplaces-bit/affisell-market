import { describe, expect, it } from "vitest"

import {
  effectiveSupplierCatalogPriceEur,
  minSupplierPriceEurFromSkuRows,
  usesVariantSkuPricing,
} from "@/lib/supplier-catalog-price"
import type { SupplierSkuTableRow } from "@/lib/supplier-sku-builder"

function row(partial: Partial<SupplierSkuTableRow> & { color: string; supplierPrice: number }): SupplierSkuTableRow {
  return {
    id: "r1",
    size: null,
    sku: "SKU-1",
    compareAtEur: null,
    stock: 10,
    commissionRate: 10,
    colorImage: undefined,
    customFields: {},
    ...partial,
  }
}

describe("supplier-catalog-price", () => {
  it("uses top-level price for simple products", () => {
    expect(
      effectiveSupplierCatalogPriceEur({
        variantFormMode: "none",
        priceFieldEur: "12.5",
        skuRows: [],
      })
    ).toBe(12.5)
  })

  it("uses minimum variant price when SKU matrix is active", () => {
    const rows = [
      row({ color: "Noir", supplierPrice: 14.99 }),
      row({ id: "r2", color: "Rouge", supplierPrice: 10.99 }),
    ]
    expect(usesVariantSkuPricing("advanced", rows)).toBe(true)
    expect(minSupplierPriceEurFromSkuRows(rows)).toBe(10.99)
    expect(
      effectiveSupplierCatalogPriceEur({
        variantFormMode: "advanced",
        priceFieldEur: "",
        skuRows: rows,
      })
    ).toBe(10.99)
  })
})
