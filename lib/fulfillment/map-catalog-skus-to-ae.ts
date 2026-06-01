import type { AeVariantMappingRowInput } from "@/lib/fulfillment/apply-ae-variant-suggestions"
import { canonicalVariantColorKey, variantColorsMatch } from "@/lib/fulfillment/variant-color-match"

/**
 * AliExpress auto-buy expects numeric sku_id from the AE catalogue (not Affisell catalogue SKU).
 * Suppliers often paste AE sku_id into ProductVariant.sku when listing on Affisell.
 */
export function normalizeAeSkuCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const aePrefix = /^AE-(\d{10,22})$/i.exec(trimmed)
  if (aePrefix?.[1]) return aePrefix[1]

  const core = trimmed.split(";")[0]?.split(":")[0]?.trim() ?? trimmed
  if (/^\d{10,22}$/.test(core)) return core

  return null
}

type ProductVariantSkuRow = {
  id: string
  color: string | null
  size: string | null
  sku: string | null
  publicPrice?: { toString(): string } | number | null
}

function findVariantForRow(
  row: AeVariantMappingRowInput,
  productVariants: ProductVariantSkuRow[]
): ProductVariantSkuRow | undefined {
  if (row.productVariantId) {
    const byId = productVariants.find((pv) => pv.id === row.productVariantId)
    if (byId) return byId
  }
  const colorKey = row.matchColor ? canonicalVariantColorKey(row.matchColor) : ""
  if (!colorKey) return undefined
  return productVariants.find((pv) => {
    const pvColor = pv.color ? canonicalVariantColorKey(pv.color) : ""
    return pvColor && variantColorsMatch(pvColor, colorKey)
  })
}

export function applySupplierCatalogSkusToMappingRows(
  rows: AeVariantMappingRowInput[],
  productVariants: ProductVariantSkuRow[]
): { rows: AeVariantMappingRowInput[]; filled: number; skipped: number } {
  let filled = 0
  let skipped = 0

  const next = rows.map((row) => {
    if (row.aeSkuId.trim()) {
      skipped += 1
      return row
    }
    const pv = findVariantForRow(row, productVariants)
    if (!pv?.sku?.trim()) return row

    const aeSkuId = normalizeAeSkuCandidate(pv.sku)
    if (!aeSkuId) return row

    filled += 1
    const label =
      row.aeLabel.trim() ||
      [pv.color, pv.size].filter(Boolean).join(" · ") ||
      pv.sku.trim()

    let aePriceCents = row.aePriceCents
    if (aePriceCents <= 0 && pv.publicPrice != null) {
      const n =
        typeof pv.publicPrice === "number"
          ? pv.publicPrice
          : Number.parseFloat(pv.publicPrice.toString())
      if (Number.isFinite(n) && n > 0) {
        aePriceCents = Math.round(n * 100)
      }
    }

    return {
      ...row,
      productVariantId: row.productVariantId || pv.id,
      matchColor: row.matchColor || pv.color || "",
      matchSize: row.matchSize || pv.size || "",
      aeSkuId,
      aeLabel: label,
      aePriceCents,
    }
  })

  return { rows: next, filled, skipped }
}

export function resolveDefaultAeSkuFromProduct(
  supplierSku: string | null | undefined,
  productVariants: ProductVariantSkuRow[]
): string | null {
  const fromProduct = supplierSku ? normalizeAeSkuCandidate(supplierSku) : null
  if (fromProduct) return fromProduct

  for (const pv of productVariants) {
    const id = pv.sku ? normalizeAeSkuCandidate(pv.sku) : null
    if (id) return id
  }
  return null
}
