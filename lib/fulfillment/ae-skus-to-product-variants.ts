import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import {
  productVariantInputSchema,
  type ProductVariantInput,
} from "@/lib/product-variant-sku"
import { VARIANT_COLOR_REGEX } from "@/lib/supplier-sku-builder"
import type { VariantCustomData } from "@/types/product"

const MAX_VARIANTS = 120

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

/** Keep Affisell color regex happy (no commas / + / AE junk like # _ *). */
export function sanitizeAeVariantColor(raw: string, index: number): string {
  let c = raw
    .trim()
    // AE often uses "#01", "01_Black", "Red+Blue" — normalize before regex gate
    .replace(/[,+]+/g, " ")
    .replace(/[#*_]+/g, " ")
    .replace(/[·•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32)
  if (!c || !VARIANT_COLOR_REGEX.test(c)) {
    c = `Variant ${index + 1}`
  }
  if (!VARIANT_COLOR_REGEX.test(c)) {
    c = `V${index + 1}`
  }
  return c.slice(0, 32)
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
  if (sku.imageUrl && /^https?:\/\//i.test(sku.imageUrl.trim())) {
    customData.image = sku.imageUrl.trim()
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
    return {
      hasVariants: false,
      variantInputs: [],
      colorImages: [],
      colors: [],
      minPriceCents: only?.aePriceCents && only.aePriceCents > 0 ? only.aePriceCents : 0,
      totalStock: only?.stock ?? 0,
      defaultAeSkuId: only?.aeSkuId ?? null,
      variantBullets: [],
    }
  }

  const variantInputs: ProductVariantInput[] = []
  const colorImages: ProductColorImageRow[] = []
  const colors: string[] = []
  const seenColor = new Set<string>()
  const seenComposite = new Set<string>()

  usable.forEach((sku, index) => {
    const displayColor =
      sku.attributes?.Couleur ||
      sku.attributes?.Color ||
      sku.attributes?.couleur ||
      sku.attributes?.color ||
      (sku.matchColor && sku.matchColor !== "default" ? sku.matchColor : null) ||
      sku.aeLabel.split("·")[0]?.trim() ||
      `Variant ${index + 1}`

    const color = sanitizeAeVariantColor(displayColor, index)
    const size = sanitizeSize(sku.matchSize)
    const priceCents = sku.aePriceCents > 0 ? sku.aePriceCents : 100
    const supplierPrice = Math.max(0.01, priceCents / 100)
    const publicPrice = Math.round(supplierPrice * 1.35 * 100) / 100
    const composite = `${color.toLowerCase()}|${(size ?? "").toLowerCase()}|${sku.aeSkuId}`
    if (seenComposite.has(composite)) return
    seenComposite.add(composite)

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
      const img =
        sku.imageUrl && /^https?:\/\//i.test(sku.imageUrl) ? sku.imageUrl.trim() : ""
      colorImages.push({
        color,
        hex: resolveColorSwatchMeta(color).hex,
        image: img,
      })
    } else if (sku.imageUrl && /^https?:\/\//i.test(sku.imageUrl)) {
      const row = colorImages.find((c) => c.color.toLowerCase() === colorKey)
      if (row && !row.image) row.image = sku.imageUrl.trim()
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
