import { parseVariantsPayload } from "@/lib/product-variants"

export function productSizeOptions(variantsJson: unknown): string[] {
  return parseVariantsPayload(variantsJson)?.size ?? []
}

export type PromotedVariantPatch = {
  promotedColor?: string | null
  promotedSize?: string | null
}

/** Keys present in `body` only — omit keys the client did not send. */
export function parsePromotedVariantPatch(
  product: { colors: string[]; variants: unknown },
  body: Record<string, unknown>
): PromotedVariantPatch | { error: string } {
  const out: PromotedVariantPatch = {}

  if ("promotedColor" in body) {
    const raw = body.promotedColor
    if (raw === null || raw === undefined) {
      out.promotedColor = null
    } else if (typeof raw === "string") {
      const c = raw.trim()
      if (!c) out.promotedColor = null
      else if (!product.colors.includes(c)) {
        return { error: "Promoted color must match a supplier color on this product." }
      } else {
        out.promotedColor = c.slice(0, 48)
      }
    } else {
      return { error: "Invalid promotedColor" }
    }
  }

  if ("promotedSize" in body) {
    const raw = body.promotedSize
    const sizes = productSizeOptions(product.variants)
    if (raw === null || raw === undefined) {
      out.promotedSize = null
    } else if (typeof raw === "string") {
      const s = raw.trim()
      if (!s) out.promotedSize = null
      else if (!sizes.includes(s)) {
        return { error: "Promoted size must match a size option on this product." }
      } else {
        out.promotedSize = s.slice(0, 40)
      }
    } else {
      return { error: "Invalid promotedSize" }
    }
  }

  return out
}
