import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import { parseVariantsPayload, type ProductVariantsJson } from "@/lib/product-variants"
import { splitVariantLineName } from "@/lib/supplier-sku-builder"

export type AffiliateVariantOption = {
  /** Stable key stored on `AffiliateProduct.promotedVariantKeys` */
  key: string
  label: string
  color: string | null
  size: string | null
  stock: number
}

export function normalizeVariantPromotionKey(key: string): string {
  return key.trim()
}

function optionFromName(name: string, stock: number): AffiliateVariantOption | null {
  const label = name.trim()
  if (!label) return null
  const { color, size } = splitVariantLineName(label)
  return {
    key: label,
    label,
    color: color || null,
    size,
    stock: Math.max(0, Math.round(stock) || 0),
  }
}

/** Build selectable variant rows for the affiliate listing builder. */
export function buildAffiliateVariantOptions(product: {
  colors: string[]
  variants: unknown
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
  }>
}): AffiliateVariantOption[] {
  const parsed = parseVariantsPayload(product.variants)
  const rows = parsed?.variantRows ?? []
  const seen = new Set<string>()
  const out: AffiliateVariantOption[] = []

  const push = (opt: AffiliateVariantOption | null) => {
    if (!opt) return
    const k = normalizeVariantPromotionKey(opt.key).toLowerCase()
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({ ...opt, key: normalizeVariantPromotionKey(opt.key) })
  }

  for (const row of rows) {
    push(optionFromName(row.name, row.stock))
  }

  if (out.length === 0 && product.productVariants?.length) {
    for (const v of product.productVariants) {
      const label = buildVariantOptionLabel(v.color, v.size)
      if (!label) continue
      push(optionFromName(label, v.stock))
    }
  }

  if (out.length === 0) {
    const sizes = parsed?.size ?? []
    const colors = product.colors.map((c) => c.trim()).filter(Boolean)
    if (colors.length > 0 && sizes.length > 0) {
      for (const color of colors) {
        for (const size of sizes) {
          const label = buildVariantOptionLabel(color, size)
          push(optionFromName(label, 0))
        }
      }
    } else if (colors.length > 0) {
      for (const color of colors) {
        push({
          key: color,
          label: color,
          color,
          size: null,
          stock: 0,
        })
      }
    } else if (sizes.length > 0) {
      for (const size of sizes) {
        push({
          key: size,
          label: size,
          color: null,
          size,
          stock: 0,
        })
      }
    }
  }

  return out
}

export function initialPromotedVariantPick(
  options: AffiliateVariantOption[],
  savedKeys: string[] | null | undefined
): Record<string, boolean> {
  const keys = (savedKeys ?? []).map(normalizeVariantPromotionKey).filter(Boolean)
  const pick: Record<string, boolean> = {}
  if (keys.length === 0) {
    for (const o of options) pick[o.key] = true
    return pick
  }
  const allowed = new Set(keys.map((k) => k.toLowerCase()))
  for (const o of options) {
    pick[o.key] = allowed.has(o.key.toLowerCase())
  }
  return pick
}

export function promotedVariantKeysFromPick(
  options: AffiliateVariantOption[],
  pick: Record<string, boolean>
): string[] {
  return options.filter((o) => pick[o.key]).map((o) => o.key)
}

export function parsePromotedVariantKeysBody(
  product: {
    colors: string[]
    variants: unknown
    hasVariants?: boolean
    productVariants?: Array<{
      color: string | null
      size: string | null
      stock: number
    }>
  },
  raw: unknown
): { promotedVariantKeys: string[] } | { error: string } {
  if (raw === undefined) return { promotedVariantKeys: [] }
  if (!Array.isArray(raw)) return { error: "Invalid promotedVariantKeys" }

  const options = buildAffiliateVariantOptions(product)
  const allowed = new Set(options.map((o) => o.key.toLowerCase()))
  const keys: string[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (typeof item !== "string") continue
    const k = normalizeVariantPromotionKey(item)
    if (!k) continue
    const lower = k.toLowerCase()
    if (!allowed.has(lower) || seen.has(lower)) continue
    seen.add(lower)
    keys.push(k)
  }

  return { promotedVariantKeys: keys }
}

function rowMatchesKey(rowName: string, keyLower: string): boolean {
  const n = rowName.trim().toLowerCase()
  if (n === keyLower) return true
  if (n.startsWith(`${keyLower} /`)) return true
  return false
}

/** Restrict PDP color/size options and variant rows to affiliate-selected keys. */
export function filterListingForPromotedVariants(params: {
  variants: ProductVariantsJson | null | undefined
  colorNames: string[]
  promotedVariantKeys: string[] | null | undefined
}): { variants: ProductVariantsJson | null; colorNames: string[] } {
  const keys = (params.promotedVariantKeys ?? [])
    .map(normalizeVariantPromotionKey)
    .filter(Boolean)
  if (keys.length === 0) {
    return {
      variants: params.variants ?? null,
      colorNames: params.colorNames,
    }
  }

  const keyLowers = keys.map((k) => k.toLowerCase())
  const keySet = new Set(keyLowers)
  const variants = params.variants ?? null
  const rows = variants?.variantRows ?? []

  if (rows.length > 0) {
    const filteredRows = rows.filter((r) =>
      keyLowers.some((k) => rowMatchesKey(r.name, k))
    )
    const colorFromRows = new Set<string>()
    for (const r of filteredRows) {
      const { color } = splitVariantLineName(r.name)
      if (color) colorFromRows.add(color)
    }
    const filteredColors = params.colorNames.filter(
      (c) => colorFromRows.has(c) || keySet.has(c.toLowerCase())
    )
    const sizesFromRows = new Set<string>()
    for (const r of filteredRows) {
      const { size } = splitVariantLineName(r.name)
      if (size) sizesFromRows.add(size)
    }
    const filteredSizes = (variants?.size ?? []).filter(
      (s) => sizesFromRows.has(s) || keySet.has(s.toLowerCase())
    )
    return {
      variants: {
        ...variants,
        variantRows: filteredRows,
        ...(filteredSizes.length > 0 ? { size: filteredSizes } : {}),
      },
      colorNames: filteredColors.length > 0 ? filteredColors : params.colorNames,
    }
  }

  const filteredColors = params.colorNames.filter((c) => keySet.has(c.toLowerCase()))
  const filteredSizes = (variants?.size ?? []).filter((s) => keySet.has(s.toLowerCase()))

  return {
    variants:
      variants && filteredSizes.length > 0
        ? { ...variants, size: filteredSizes }
        : variants,
    colorNames: filteredColors.length > 0 ? filteredColors : params.colorNames,
  }
}
