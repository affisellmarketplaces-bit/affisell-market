import { describe, expect, it } from "vitest"

import {
  effectiveSupplierCatalogPriceEur,
  minSupplierPriceEurFromSkuRows,
  resolveSupplierListingCompareAtEur,
  resolveSupplierProductCompareAtEur,
  supplierListingDiscountPct,
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

  it("resolves compare-at from SKU variant mirror when product field is empty", () => {
    const compare = resolveSupplierListingCompareAtEur({
      basePriceCents: 19780,
      compareAt: null,
      variants: {
        variantRows: [
          {
            id: "v1",
            name: "Noir",
            sku: "SKU-1",
            priceCents: 19780,
            stock: 10,
            commission: 20,
            sales: 0,
            compareAtCents: 29990,
          },
        ],
      },
    })
    expect(compare).toBe(299.9)
    expect(supplierListingDiscountPct(19780, compare)).toBe(34)
  })

  it("syncs product compare-at from filled SKU rows on save", () => {
    const rows = [
      row({ color: "M365", supplierPrice: 197.8, compareAtEur: 299.9 }),
      row({ id: "r2", color: "ES80", supplierPrice: 273.71, compareAtEur: 349.9 }),
    ]
    expect(
      resolveSupplierProductCompareAtEur({
        variantFormMode: "advanced",
        priceFieldCompareAt: "",
        skuRows: rows,
        basePriceCents: 19780,
      })
    ).toBe(299.9)
  })
})
