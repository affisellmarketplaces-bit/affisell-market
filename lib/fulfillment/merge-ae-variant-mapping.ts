import {
  colorSizeFromAttributes,
  parseVariantMapping,
  type VariantMappingRecord,
} from "@/lib/sku/variant-mapping"
import { orderVariantKeys } from "@/lib/fulfillment/resolve-supplier-sku"
import { variantColorsMatch, canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"

export type ProductVariantAeRow = {
  id: string
  color: string | null
  size: string | null
  attributes: unknown
  supplierSku: string | null
  wholesalePriceCents: number | null
}

function parseAttributes(json: unknown): VariantMappingRecord | null {
  return parseVariantMapping(json)
}

function variantRowMatchesOrder(
  row: ProductVariantAeRow,
  color: string | null,
  size: string | null
): boolean {
  const attrs = parseAttributes(row.attributes)
  const fromAttrs = attrs ? colorSizeFromAttributes(attrs) : { color: null, size: null }
  const rowColor = row.color ?? fromAttrs.color
  const rowSize = row.size ?? fromAttrs.size

  if (rowColor && color) {
    if (!variantColorsMatch(canonicalVariantColorKey(rowColor), canonicalVariantColorKey(color))) {
      return false
    }
  } else if (rowColor && !color) {
    return false
  }

  if (rowSize && size) {
    const a = rowSize.trim().toLowerCase()
    const b = size.trim().toLowerCase()
    if (a !== b) return false
  }

  return Boolean(rowColor || rowSize || attrs)
}

/** Merge product-level AE mapping with the matched variant row for browser checkout. */
export function mergeAeVariantMappingForOrder(input: {
  productVariantMapping: unknown
  productVariants: ProductVariantAeRow[]
  order: { variantLabel: string | null; variantSignature?: string | null }
}): {
  mapping: VariantMappingRecord
  matchedVariant: ProductVariantAeRow | null
} {
  const base = parseVariantMapping(input.productVariantMapping) ?? {}
  const { color, size } = orderVariantKeys(input.order)

  let matched: ProductVariantAeRow | null = null
  for (const row of input.productVariants) {
    if (variantRowMatchesOrder(row, color, size)) {
      matched = row
      break
    }
  }

  const variantAttrs = matched ? parseAttributes(matched.attributes) : null
  const mapping: VariantMappingRecord = { ...base, ...(variantAttrs ?? {}) }

  return { mapping, matchedVariant: matched }
}
