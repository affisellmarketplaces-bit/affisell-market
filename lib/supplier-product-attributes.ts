import { CATEGORIES } from "@/lib/product-catalog-constants"
import { parseProductColorImagesFromBody, type ProductColorImageRow } from "@/lib/product-color-images"
import { parseVariantsPayload, type ProductVariantsJson } from "@/lib/product-variants"

const CATEGORY_SET = new Set(CATEGORIES as readonly string[])

/** Allowlisted categories only; max 3 */
export function parseProductCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => CATEGORY_SET.has(s))
    .slice(0, 3)
  return [...new Set(out)]
}

export function parseProductColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24)
  return [...new Set(out)]
}

export function parseProductTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40)
}

export type ParsedProductAttributes = {
  categories: string[]
  colors: string[]
  tags: string[]
  variants: ProductVariantsJson | null
  colorImages: ProductColorImageRow[] | null
}

export function parseProductAttributesBody(body: Record<string, unknown>): ParsedProductAttributes {
  const variants = parseVariantsPayload(body.variants)
  return {
    categories: parseProductCategories(body.categories),
    colors: parseProductColors(body.colors),
    tags: parseProductTags(body.tags),
    variants,
    colorImages: parseProductColorImagesFromBody(body.colorImages),
  }
}
