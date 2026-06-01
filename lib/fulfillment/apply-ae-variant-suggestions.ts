import { isValidAeSkuId } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import {
  canonicalVariantColorKey,
  variantColorsMatch,
} from "@/lib/fulfillment/variant-color-match"

export type AeVariantMappingRowInput = {
  key: string
  productVariantId: string
  matchColor: string
  matchSize: string
  aeSkuId: string
  aePriceCents: number
  aeLabel: string
}

export type AeVariantSuggestion = {
  productVariantId: string
  aeSkuId: string
  matchColor: string | null
  aePriceCents: number
  aeLabel: string
}

export type ApplyAeSuggestionsResult = {
  rows: AeVariantMappingRowInput[]
  filled: number
  skipped: number
}

/**
 * Pré-remplit les lignes vides sans écraser les SKU déjà saisis.
 * Match par productVariantId ou par couleur (matchColor).
 */
export function applyAeVariantSuggestions(
  rows: AeVariantMappingRowInput[],
  suggestions: AeVariantSuggestion[],
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

    const byPv = suggestions.find(
      (s) => s.productVariantId && s.productVariantId === row.productVariantId
    )
    const pick =
      byPv ??
      suggestions.find((s) => {
        if (!s.matchColor || !row.matchColor.trim()) return false
        return variantColorsMatch(s.matchColor, row.matchColor)
      })

    if (!pick?.aeSkuId || !isValidAeSkuId(pick.aeSkuId) || usedAe.has(pick.aeSkuId)) return row

    usedAe.add(pick.aeSkuId)
    filled += 1
    const catalog = aeSkus.find((s) => s.aeSkuId === pick.aeSkuId)
    return {
      ...row,
      aeSkuId: pick.aeSkuId,
      aePriceCents: pick.aePriceCents || catalog?.aePriceCents || row.aePriceCents,
      aeLabel: pick.aeLabel || catalog?.aeLabel || row.aeLabel,
      matchColor: row.matchColor || pick.matchColor || canonicalVariantColorKey(row.matchColor) || "",
    }
  })

  return { rows: next, filled, skipped }
}
