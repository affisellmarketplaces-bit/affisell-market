import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import {
  isNumericOnlyVariantToken,
  normalizeAeVariantColorLabel,
  resolveAeVariantDisplayColor,
} from "@/lib/fulfillment/ae-variant-display-name"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import {
  productVariantInputSchema,
  type ProductVariantInput,
} from "@/lib/product-variant-sku"
import type { VariantCustomData } from "@/types/product"

export type AeSkuVariantPersist = {
  hasVariants: boolean
  variantInputs: ProductVariantInput[]
  colorImages: ProductColorImageRow[]
  colors: string[]
  minPriceCents: number
  totalStock: number
  defaultAeSkuId: string | null
  /** Bullets derived from SKU labels (fallback when AE specs missing) */
  variantBullets: string[]
}

const MAX_VARIANTS = 120

/** True when most shopper labels collapsed to generic `Variant N`. */
export function isWeakAeSkuPersist(persist: AeSkuVariantPersist): boolean {
  if (persist.variantInputs.length < 2) return true
  let weak = 0
  persist.variantInputs.forEach((v, index) => {
    const label = resolveAeVariantDisplayColor(
      {
        aeLabel: typeof v.customData?.aeLabel === "string" ? v.customData.aeLabel : v.color,
        matchColor: v.color,
        attributes:
          typeof v.customData === "object" && v.customData
            ? Object.fromEntries(
                Object.entries(v.customData).filter(
                  ([k, val]) => k !== "aeLabel" && k !== "image" && typeof val === "string"
                )
              )
            : undefined,
      },
      index
    )
    if (/^Variant \d+$/i.test(label) || isNumericOnlyVariantToken(label)) weak += 1
  })
  return weak / persist.variantInputs.length >= 0.5
}

/** Overlay API stock/prices onto HTML-parsed SKU rows (same aeSkuId). */
export function mergeAeProductSkuRows(
  apiRows: AeProductSkuRow[],
  htmlRows: AeProductSkuRow[]
): AeProductSkuRow[] {
  const apiById = new Map(apiRows.map((r) => [r.aeSkuId, r]))
  const out: AeProductSkuRow[] = []
  const seen = new Set<string>()

  for (const row of htmlRows) {
    const api = apiById.get(row.aeSkuId)
    out.push(
      api
        ? {
            ...row,
            aePriceCents: api.aePriceCents > 0 ? api.aePriceCents : row.aePriceCents,
            stock: api.stock >= 0 ? api.stock : row.stock,
          }
        : row
    )
    seen.add(row.aeSkuId)
  }

  for (const row of apiRows) {
    if (!seen.has(row.aeSkuId)) out.push(row)
  }

  return out
}

/** Keep Affisell color regex happy (no commas / + / AE junk like # _ *). */
export function sanitizeAeVariantColor(raw: string, index: number): string {
  return normalizeAeVariantColorLabel(raw, index)
}

function sanitizeSize(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return raw.trim().slice(0, 16)
}

function buildAeVariantCustomData(
  sku: AeProductSkuRow,
  priceCents: number
): VariantCustomData {
  const customData: VariantCustomData = {
    aeLabel: sku.aeLabel,
    aePriceCents: priceCents,
  }
  if (sku.imageUrl) {
    const abs = sku.imageUrl.trim().startsWith("//")
      ? `https:${sku.imageUrl.trim()}`
      : sku.imageUrl.trim()
    if (/^https?:\/\//i.test(abs)) customData.image = abs
  }
  if (sku.attributes) {
    for (const [key, value] of Object.entries(sku.attributes)) {
      if (typeof value === "string" && value.trim()) {
        customData[key.slice(0, 64)] = value.slice(0, 200)
      }
    }
  }
  return customData
}

/**
 * Map AE sellable SKUs → ProductVariant matrix + color swatches.
 * Single (or empty) SKU → hasVariants false (Instant Enlist single-SKU path unchanged).
 */
export function aeSkusToVariantPersist(aeSkus: AeProductSkuRow[]): AeSkuVariantPersist {
  const usable = aeSkus.filter((s) => s.aeSkuId.trim().length > 0).slice(0, MAX_VARIANTS)

  if (usable.length <= 1) {
    const only = usable[0]
    const colorImages: ProductColorImageRow[] = []
    const colors: string[] = []
    if (only) {
      const displayColor = resolveAeVariantDisplayColor(only, 0)
      if (displayColor && !/^Variant \d+$/i.test(displayColor)) {
        const color = sanitizeAeVariantColor(displayColor, 0)
        colors.push(color)
        const img =
          only.imageUrl &&
          (/^https?:\/\//i.test(only.imageUrl.trim()) || only.imageUrl.trim().startsWith("//"))
            ? only.imageUrl.trim().startsWith("//")
              ? `https:${only.imageUrl.trim()}`
              : only.imageUrl.trim()
            : ""
        colorImages.push({
          color,
          hex: resolveColorSwatchMeta(color).hex,
          image: img,
        })
      }
    }
    return {
      hasVariants: false,
      variantInputs: [],
      colorImages,
      colors,
      minPriceCents: only?.aePriceCents && only.aePriceCents > 0 ? only.aePriceCents : 0,
      totalStock: only?.stock ?? 0,
      defaultAeSkuId: only?.aeSkuId ?? null,
      variantBullets: only?.aeLabel ? [`${only.aeLabel}`] : [],
    }
  }

  const variantInputs: ProductVariantInput[] = []
  const colorImages: ProductColorImageRow[] = []
  const colors: string[] = []
  const seenColor = new Set<string>()
  const seenComposite = new Set<string>()

  usable.forEach((sku, index) => {
    const displayColor = resolveAeVariantDisplayColor(sku, index)
    const color = sanitizeAeVariantColor(displayColor, index)
    const size = sanitizeSize(sku.matchSize)
    const priceCents = sku.aePriceCents > 0 ? sku.aePriceCents : 100
    const supplierPrice = Math.max(0.01, priceCents / 100)
    const publicPrice = Math.round(supplierPrice * 1.35 * 100) / 100
    const composite = `${color.toLowerCase()}|${(size ?? "").toLowerCase()}|${sku.aeSkuId}`
    if (seenComposite.has(composite)) return
    seenComposite.add(composite)

    const skuImage =
      sku.imageUrl &&
      (/^https?:\/\//i.test(sku.imageUrl.trim()) || sku.imageUrl.trim().startsWith("//"))
        ? sku.imageUrl.trim().startsWith("//")
          ? `https:${sku.imageUrl.trim()}`
          : sku.imageUrl.trim()
        : ""

    // Parse through Zod so output matches ProductVariantInput (transformed schema).
    const parsed = productVariantInputSchema.safeParse({
      color,
      size,
      sku: sku.aeSkuId.slice(0, 64),
      supplierPrice,
      publicPrice,
      stock: Math.max(0, sku.stock),
      commissionRate: 10,
      customData: buildAeVariantCustomData(sku, priceCents),
    })
    if (!parsed.success) return
    variantInputs.push(parsed.data)

    const colorKey = color.toLowerCase()
    if (!seenColor.has(colorKey)) {
      seenColor.add(colorKey)
      colors.push(color)
      colorImages.push({
        color,
        hex: resolveColorSwatchMeta(color).hex,
        image: skuImage,
      })
    } else if (skuImage) {
      const row = colorImages.find((c) => c.color.toLowerCase() === colorKey)
      if (row && !row.image) row.image = skuImage
    }
  })

  const prices = usable.map((s) => s.aePriceCents).filter((p) => p > 0)
  const minPriceCents = prices.length > 0 ? Math.min(...prices) : 0
  const totalStock = usable.reduce((acc, s) => acc + Math.max(0, s.stock), 0)
  const cheapest = [...usable].sort((a, b) => a.aePriceCents - b.aePriceCents)[0]

  const variantBullets = usable
    .slice(0, 12)
    .map((s) => {
      const price =
        s.aePriceCents > 0 ? `${(s.aePriceCents / 100).toFixed(2)} €` : "—"
      return `${s.aeLabel} — ${price}`
    })

  return {
    hasVariants: variantInputs.length > 1,
    variantInputs,
    colorImages,
    colors,
    minPriceCents,
    totalStock,
    defaultAeSkuId: cheapest?.aeSkuId ?? usable[0]?.aeSkuId ?? null,
    variantBullets,
  }
}
