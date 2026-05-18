import type { ProductVariantsJson } from "@/lib/product-variants"

export const PURCHASE_QTY_MIN = 1
export const PURCHASE_QTY_MAX = 99

export function buildVariantOptionLabel(
  color: string | null | undefined,
  size: string | null | undefined
): string {
  const c = color?.trim() ?? ""
  const s = size?.trim() ?? ""
  if (c && s) return `${c} / ${s}`
  return c || s
}

/** Available units for the current color/size selection (variant row stock or product stock). */
export function resolveListingAvailableStock(params: {
  productStock: number
  variants: ProductVariantsJson | null | undefined
  selectedColor: string | null | undefined
  selectedSize: string | null | undefined
}): number {
  const fallback = Math.max(0, Math.round(params.productStock) || 0)
  const rows = params.variants?.variantRows ?? []
  if (rows.length === 0) return fallback

  const label = buildVariantOptionLabel(params.selectedColor, params.selectedSize)
  if (label) {
    const exact = rows.find((r) => r.name.trim().toLowerCase() === label.toLowerCase())
    if (exact) return Math.max(0, Math.round(exact.stock) || 0)
  }

  const color = params.selectedColor?.trim()
  if (color) {
    const colorOnly = rows.find((r) => r.name.trim().toLowerCase() === color.toLowerCase())
    if (colorOnly) return Math.max(0, Math.round(colorOnly.stock) || 0)

    const prefix = `${color.toLowerCase()} /`
    const matching = rows.filter((r) => r.name.trim().toLowerCase().startsWith(prefix))
    if (matching.length > 0) {
      return matching.reduce((sum, r) => sum + Math.max(0, Math.round(r.stock) || 0), 0)
    }
  }

  const size = params.selectedSize?.trim()
  if (size && rows.length > 0) {
    const suffix = ` / ${size.toLowerCase()}`
    const matching = rows.filter((r) => r.name.trim().toLowerCase().endsWith(suffix))
    if (matching.length > 0) {
      return matching.reduce((sum, r) => sum + Math.max(0, Math.round(r.stock) || 0), 0)
    }
  }

  const rowSum = rows.reduce((sum, r) => sum + Math.max(0, Math.round(r.stock) || 0), 0)
  return rowSum > 0 ? rowSum : fallback
}

export function clampPurchaseQuantity(qty: number, availableStock: number): number {
  const maxFromStock =
    availableStock > 0 ? Math.min(PURCHASE_QTY_MAX, availableStock) : PURCHASE_QTY_MAX
  const n = Math.round(Number(qty)) || PURCHASE_QTY_MIN
  return Math.max(PURCHASE_QTY_MIN, Math.min(maxFromStock, n))
}

export function purchaseQuantityOptions(availableStock: number): number[] {
  const max = clampPurchaseQuantity(PURCHASE_QTY_MAX, availableStock)
  return Array.from({ length: max }, (_, i) => i + 1)
}
