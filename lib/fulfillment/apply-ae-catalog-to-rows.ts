import {
  applyAeVariantSuggestions,
  type AeVariantMappingRowInput,
  type AeVariantSuggestion,
  type ApplyAeSuggestionsResult,
} from "@/lib/fulfillment/apply-ae-variant-suggestions"
import { isValidAeSkuId } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import { suggestVariantMappings } from "@/lib/fulfillment/resolve-supplier-sku"
import {
  canonicalVariantColorKey,
  variantColorsMatch,
} from "@/lib/fulfillment/variant-color-match"

type ProductVariantRow = {
  id: string
  color: string | null
  size: string | null
}

/** Map imported AE catalogue onto variant rows (by color / label). */
export function applyAeCatalogToVariantRows(
  rows: AeVariantMappingRowInput[],
  productVariants: ProductVariantRow[],
  aeSkus: AeProductSkuRow[]
): ApplyAeSuggestionsResult {
  const usedAe = new Set<string>()
  for (const r of rows) {
    const id = r.aeSkuId.trim()
    if (id && isValidAeSkuId(id)) usedAe.add(id)
  }

  let filled = 0
  let skipped = 0

  const next = rows.map((row) => {
    const existing = row.aeSkuId.trim()
    if (existing && isValidAeSkuId(existing)) {
      skipped += 1
      return row
    }

    const pv = productVariants.find((p) => p.id === row.productVariantId)
    const colorKey = row.matchColor
      ? canonicalVariantColorKey(row.matchColor)
      : pv?.color
        ? canonicalVariantColorKey(pv.color)
        : ""

    const pick = aeSkus.find((s) => {
      if (!isValidAeSkuId(s.aeSkuId) || usedAe.has(s.aeSkuId)) return false
      if (!colorKey) return false
      if (s.matchColor && variantColorsMatch(s.matchColor, colorKey)) return true
      if (variantColorsMatch(s.aeLabel, colorKey)) return true
      if (pv?.color && variantColorsMatch(s.aeLabel, pv.color)) return true
      return false
    })

    if (!pick) return row

    usedAe.add(pick.aeSkuId)
    filled += 1
    return {
      ...row,
      aeSkuId: pick.aeSkuId,
      aePriceCents: pick.aePriceCents || row.aePriceCents,
      aeLabel: pick.aeLabel || row.aeLabel,
      matchColor: row.matchColor || pick.matchColor || colorKey || "",
      matchSize: row.matchSize || pick.matchSize || pv?.size || "",
    }
  })

  return { rows: next, filled, skipped }
}

export function applyImportedAeCatalogToVariantRows(
  rows: AeVariantMappingRowInput[],
  productVariants: ProductVariantRow[],
  aeSkus: AeProductSkuRow[],
  suggestions?: AeVariantSuggestion[]
): { rows: AeVariantMappingRowInput[]; catalogSize: number; mappedRows: number } {
  const sug =
    suggestions && suggestions.length > 0
      ? suggestions
      : suggestVariantMappings(productVariants, aeSkus)

  const { rows: afterSuggest, filled: f1 } = applyAeVariantSuggestions(rows, sug, aeSkus)
  const { rows: afterCatalog, filled: f2 } = applyAeCatalogToVariantRows(
    afterSuggest,
    productVariants,
    aeSkus
  )

  const mappedRows = afterCatalog.filter(
    (r) => r.aeSkuId.trim() && isValidAeSkuId(r.aeSkuId)
  ).length

  return {
    rows: afterCatalog,
    catalogSize: aeSkus.length,
    mappedRows,
  }
}
