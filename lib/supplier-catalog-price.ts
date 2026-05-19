import type { SupplierVariantFormMode } from "@/lib/supplier-add-product-draft-cache"
import type { SupplierSkuTableRow } from "@/lib/supplier-sku-builder"

export function filledSupplierSkuRows(rows: SupplierSkuTableRow[]): SupplierSkuTableRow[] {
  return rows.filter((r) => r.color.trim().length > 0)
}

/** Lowest wholesale EUR among filled SKU rows, if any. */
export function minSupplierPriceEurFromSkuRows(rows: SupplierSkuTableRow[]): number | null {
  const prices = filledSupplierSkuRows(rows)
    .map((r) => r.supplierPrice)
    .filter((p) => Number.isFinite(p) && p > 0)
  if (prices.length === 0) return null
  return Math.min(...prices)
}

/**
 * Catalog wholesale price used for compare-at checks, simulation, and product.basePriceCents.
 * Simple product → top-level price field. SKU matrix → min variant price (then field fallback).
 */
export function effectiveSupplierCatalogPriceEur(args: {
  variantFormMode: SupplierVariantFormMode
  priceFieldEur: string | number
  skuRows: SupplierSkuTableRow[]
}): number | null {
  if (args.variantFormMode === "advanced") {
    const fromVariants = minSupplierPriceEurFromSkuRows(args.skuRows)
    if (fromVariants != null) return fromVariants
  }
  const p = Number(args.priceFieldEur)
  return Number.isFinite(p) && p > 0 ? p : null
}

export function usesVariantSkuPricing(variantFormMode: SupplierVariantFormMode, skuRows: SupplierSkuTableRow[]): boolean {
  return variantFormMode === "advanced" && filledSupplierSkuRows(skuRows).length > 0
}
