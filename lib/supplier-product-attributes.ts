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

function merchandisingVariantsRaw(body: Record<string, unknown>): unknown {
  if (body.listingVariants != null) return body.listingVariants
  const v = body.variants
  if (v != null && typeof v === "object" && !Array.isArray(v)) return v
  return null
}

export function parseProductAttributesBody(body: Record<string, unknown>): ParsedProductAttributes {
  const variants = parseVariantsPayload(merchandisingVariantsRaw(body))
  return {
    categories: parseProductCategories(body.categories),
    colors: parseProductColors(body.colors),
    tags: parseProductTags(body.tags),
    variants,
    colorImages: parseProductColorImagesFromBody(body.colorImages),
  }
}

export type NormalizedProductAttribute = { key: string; label: string; value: string }

export function normalizeProductAttributesFromBody(
  rows: unknown
): NormalizedProductAttribute[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
    .filter((row): row is Record<string, unknown> => row != null)
    .map((row) => ({
      key: String(row.key ?? "").trim(),
      label: String(row.label ?? row.key ?? "").trim(),
      value: String(row.value ?? "").trim(),
    }))
    .filter((r) => r.key.length > 0 && r.value.length > 0)
}

function attributeSignature(rows: NormalizedProductAttribute[]): string {
  return rows
    .map((r) => `${r.key}\0${r.label}\0${r.value}`)
    .sort()
    .join("\n")
}

export function supplierProductAttributesEqual(
  existing: NormalizedProductAttribute[],
  incoming: NormalizedProductAttribute[]
): boolean {
  return attributeSignature(existing) === attributeSignature(incoming)
}

/**
 * Keys a form declares it OWNS (`managedAttributeKeys` in the request body). Absent / empty = the legacy contract, where
 * `productAttributes` replaces the whole set.
 *
 * Why it exists: a form only knows the attributes of the category it renders. Saving from it used to delete every other
 * row — e.g. editing a product created by the guided wizard in the classic form silently wiped its manufacturer (GPSR),
 * material and dimensions. With a managed list, only the rows the form owns are replaced; the rest is preserved.
 */
export function parseManagedAttributeKeys(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const keys = raw
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k.length <= 120)
    .slice(0, 300)
  return keys.length > 0 ? [...new Set(keys)] : null
}

export function mergeManagedProductAttributes(
  existing: NormalizedProductAttribute[],
  incoming: NormalizedProductAttribute[],
  managedKeys: string[] | null
): NormalizedProductAttribute[] {
  if (!managedKeys) return incoming
  const managed = new Set(managedKeys)
  const incomingKeys = new Set(incoming.map((r) => r.key))
  const preserved = existing.filter((r) => !managed.has(r.key) && !incomingKeys.has(r.key))
  return [...preserved, ...incoming]
}
