import type { ProductVariantInput } from "@/lib/product-variant-sku"
import type { ProductVariantLine } from "@/lib/product-variants"
import { skuTableRowFromApiVariant, type SupplierSkuTableRow } from "@/lib/supplier-sku-builder"
import type { UrlImportFormPatch } from "@/lib/url-import-apply"

function variantLinesToSkuTableRows(rows: ProductVariantLine[]): SupplierSkuTableRow[] {
  return rows.map((row) => {
    const parts = row.name.split(" · ").map((p) => p.trim())
    const color = parts[0] ?? row.name
    const size = parts.length > 1 ? parts.slice(1).join(" · ") : null
    return skuTableRowFromApiVariant({
      id: row.id,
      color,
      size,
      sku: row.sku,
      supplierPrice: row.priceCents / 100,
      stock: row.stock,
      commissionRate: row.commission,
      customData: row.image ? { image: row.image } : undefined,
    })
  })
}

/** AE Express import → wizard Pro advanced SKU matrix (never OPTIONS bullets in description). */
export function advancedSkuRowsFromExpressImport(args: {
  skuVariants: { hasVariants: boolean; variants: ProductVariantInput[] } | null
  patch: UrlImportFormPatch | null
}): SupplierSkuTableRow[] {
  const { skuVariants, patch } = args

  if (skuVariants?.hasVariants && skuVariants.variants.length >= 2) {
    return skuVariants.variants.map((row) =>
      skuTableRowFromApiVariant({
        ...row,
        color: row.color,
        size: row.size ?? null,
        sku: row.sku ?? null,
        customData: row.customData ?? null,
      })
    )
  }

  const importRows = patch?.variants.mode === "advanced" ? patch.variants.variantRows : []
  if (importRows.length >= 2) {
    return variantLinesToSkuTableRows(importRows)
  }

  return []
}
