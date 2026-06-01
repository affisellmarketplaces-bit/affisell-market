import { isValidAeSkuId } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { colorNameFromVariantLabel } from "@/lib/cart-line-image"
import { parseCartVariantSignature } from "@/lib/cart-variant"
import {
  canonicalVariantColorKey,
  normalizeVariantColorKey,
  variantColorsMatch,
} from "@/lib/fulfillment/variant-color-match"

export type SupplierLinkVariantRow = {
  id: string
  productVariantId: string | null
  matchColor: string | null
  matchSize: string | null
  aeSkuId: string
  aePriceCents: number
  aeShippingCents: number
  aeLabel: string | null
}

export type SupplierLinkDefaults = {
  aeSkuId: string | null
  aePriceCents: number
  aeShippingCents: number
}

export type ResolvedSupplierSku = {
  aeSkuId: string | null
  aePriceCents: number
  aeShippingCents: number
  source: "variant_mapping" | "link_default" | "unmatched"
  mappingId: string | null
}

export type ProductVariantForMatch = {
  id: string
  color: string | null
  size: string | null
}

export function orderVariantKeys(order: {
  variantLabel: string | null
  variantSignature?: string | null
}): { color: string | null; size: string | null } {
  const parsed = parseCartVariantSignature(order.variantSignature ?? "")
  const color =
    parsed.color ||
    colorNameFromVariantLabel(order.variantLabel) ||
    null
  const size = parsed.size || null
  return { color, size }
}

function mappingMatchesOrder(
  row: SupplierLinkVariantRow,
  color: string | null,
  size: string | null
): boolean {
  const rowColor = row.matchColor ? canonicalVariantColorKey(row.matchColor) : ""
  const orderColor = color ? canonicalVariantColorKey(color) : ""

  if (rowColor && orderColor) {
    if (!variantColorsMatch(rowColor, orderColor)) return false
  } else if (rowColor && !orderColor) {
    return false
  }

  const rowSize = normalizeVariantColorKey(row.matchSize)
  const orderSize = normalizeVariantColorKey(size)
  if (rowSize && orderSize && rowSize !== orderSize) return false

  return Boolean(rowColor || rowSize || row.productVariantId)
}

/** Resolve AE SKU + purchase price for a paid order line. */
export function resolveSupplierSkuForOrder(
  defaults: SupplierLinkDefaults,
  mappings: SupplierLinkVariantRow[],
  order: {
    variantLabel: string | null
    variantSignature?: string | null
    quantity: number
  },
  productVariants: ProductVariantForMatch[] = []
): ResolvedSupplierSku {
  const { color, size } = orderVariantKeys(order)

  if (productVariants.length > 0 && (color || size)) {
    const pv = productVariants.find((v) => {
      const vc = v.color ? canonicalVariantColorKey(v.color) : ""
      const vs = normalizeVariantColorKey(v.size)
      const oc = color ? canonicalVariantColorKey(color) : ""
      const os = normalizeVariantColorKey(size)
      if (vc && oc && !variantColorsMatch(vc, oc)) return false
      if (vs && os && vs !== os) return false
      return Boolean(vc || vs)
    })
    if (pv) {
      const byPv = mappings.find((m) => m.productVariantId === pv.id)
      if (byPv?.aeSkuId) {
        return {
          aeSkuId: byPv.aeSkuId,
          aePriceCents: byPv.aePriceCents,
          aeShippingCents: byPv.aeShippingCents || defaults.aeShippingCents,
          source: "variant_mapping",
          mappingId: byPv.id,
        }
      }
    }
  }

  const byAttrs = mappings.filter((m) => mappingMatchesOrder(m, color, size))
  const best = byAttrs.sort((a, b) => {
    const aScore =
      (a.productVariantId ? 2 : 0) +
      (a.matchColor ? 1 : 0) +
      (a.matchSize ? 1 : 0)
    const bScore =
      (b.productVariantId ? 2 : 0) +
      (b.matchColor ? 1 : 0) +
      (b.matchSize ? 1 : 0)
    return bScore - aScore
  })[0]

  if (best?.aeSkuId) {
    return {
      aeSkuId: best.aeSkuId,
      aePriceCents: best.aePriceCents,
      aeShippingCents: best.aeShippingCents || defaults.aeShippingCents,
      source: "variant_mapping",
      mappingId: best.id,
    }
  }

  if (defaults.aeSkuId) {
    return {
      aeSkuId: defaults.aeSkuId,
      aePriceCents: defaults.aePriceCents,
      aeShippingCents: defaults.aeShippingCents,
      source: color || size ? "unmatched" : "link_default",
      mappingId: null,
    }
  }

  return {
    aeSkuId: null,
    aePriceCents: defaults.aePriceCents,
    aeShippingCents: defaults.aeShippingCents,
    source: "unmatched",
    mappingId: null,
  }
}

/** Suggest AE SKU rows for each Affisell ProductVariant by color name. */
export function suggestVariantMappings(
  productVariants: ProductVariantForMatch[],
  aeSkus: { aeSkuId: string; aeLabel: string; matchColor: string | null; aePriceCents: number }[]
): {
  productVariantId: string
  aeSkuId: string
  matchColor: string | null
  aePriceCents: number
  aeLabel: string
}[] {
  const out: {
    productVariantId: string
    aeSkuId: string
    matchColor: string | null
    aePriceCents: number
    aeLabel: string
  }[] = []
  const usedAe = new Set<string>()

  for (const pv of productVariants) {
    const pvColor = pv.color ? canonicalVariantColorKey(pv.color) : ""
    if (!pvColor) continue
    const ae = aeSkus.find((s) => {
      if (!s.aeSkuId || !isValidAeSkuId(s.aeSkuId) || usedAe.has(s.aeSkuId)) return false
      if (s.matchColor && variantColorsMatch(s.matchColor, pvColor)) return true
      return variantColorsMatch(s.aeLabel, pv.color)
    })
    if (!ae?.aeSkuId) continue
    usedAe.add(ae.aeSkuId)
    out.push({
      productVariantId: pv.id,
      aeSkuId: ae.aeSkuId,
      matchColor: pvColor,
      aePriceCents: ae.aePriceCents,
      aeLabel: ae.aeLabel,
    })
  }

  return out
}
