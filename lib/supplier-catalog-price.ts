import type { SupplierVariantFormMode } from "@/lib/supplier-add-product-draft-cache"
import { parseVariantsPayload } from "@/lib/product-variants"
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

/** Compare-at EUR for supplier catalog cards — product field or SKU mirror (`variantRows`). */
export function resolveSupplierListingCompareAtEur(args: {
  basePriceCents: number
  compareAt: number | null | undefined
  variants: unknown
}): number | null {
  const baseEur = args.basePriceCents / 100
  const topLevel = args.compareAt
  if (topLevel != null && Number.isFinite(topLevel) && topLevel > baseEur) {
    return topLevel
  }

  const lines = parseVariantsPayload(args.variants)?.variantRows ?? []
  if (lines.length === 0) return null

  const minPriceCents = Math.min(
    ...lines.map((line) => (line.priceCents > 0 ? line.priceCents : args.basePriceCents))
  )

  let fromCheapestRow: number | null = null
  for (const line of lines) {
    const priceCents = line.priceCents > 0 ? line.priceCents : args.basePriceCents
    if (priceCents !== minPriceCents) continue
    const compareEur =
      line.compareAtCents != null && line.compareAtCents > 0 ? line.compareAtCents / 100 : null
    const priceEur = priceCents / 100
    if (compareEur != null && compareEur > priceEur) {
      fromCheapestRow =
        fromCheapestRow == null ? compareEur : Math.max(fromCheapestRow, compareEur)
    }
  }
  if (fromCheapestRow != null) return fromCheapestRow

  for (const line of lines) {
    const priceEur = (line.priceCents > 0 ? line.priceCents : args.basePriceCents) / 100
    const compareEur =
      line.compareAtCents != null && line.compareAtCents > 0 ? line.compareAtCents / 100 : null
    if (compareEur != null && compareEur > priceEur) return compareEur
  }

  return null
}

export function supplierListingDiscountPct(
  basePriceCents: number,
  compareAtEur: number | null
): number {
  if (compareAtEur == null || !Number.isFinite(compareAtEur)) return 0
  const baseEur = basePriceCents / 100
  if (compareAtEur <= baseEur) return 0
  return Math.round(((compareAtEur - baseEur) / compareAtEur) * 100)
}

/** Persist product.compareAt from SKU rows when the top-level field is empty. */
export function resolveSupplierProductCompareAtEur(args: {
  variantFormMode: SupplierVariantFormMode
  priceFieldCompareAt: string | number | null | undefined
  skuRows: SupplierSkuTableRow[]
  basePriceCents: number
}): number | null {
  const baseEur = args.basePriceCents / 100
  const topRaw = args.priceFieldCompareAt
  const topNum =
    topRaw == null || (typeof topRaw === "string" && !topRaw.trim())
      ? null
      : Number(topRaw)
  if (topNum != null && Number.isFinite(topNum) && topNum > baseEur) {
    return topNum
  }

  if (args.variantFormMode !== "advanced") return null

  const minSupplier = minSupplierPriceEurFromSkuRows(args.skuRows)
  let fromVariants: number | null = null
  for (const row of filledSupplierSkuRows(args.skuRows)) {
    const supplier = row.supplierPrice > 0 ? row.supplierPrice : baseEur
    const compare = row.compareAtEur
    if (compare == null || !Number.isFinite(compare) || compare <= supplier) continue
    if (minSupplier != null && Math.abs(supplier - minSupplier) > 0.009) continue
    fromVariants = fromVariants == null ? compare : Math.max(fromVariants, compare)
  }
  if (fromVariants != null) return fromVariants

  for (const row of filledSupplierSkuRows(args.skuRows)) {
    const supplier = row.supplierPrice > 0 ? row.supplierPrice : baseEur
    const compare = row.compareAtEur
    if (compare != null && Number.isFinite(compare) && compare > supplier) {
      return compare
    }
  }

  return null
}
