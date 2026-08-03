/** Affiliate listing overrides for variant display (names + photos). Keys = stable supplier variant keys. */

import { trimColorSwatchImageForStore } from "@/lib/color-swatch-store"
import { normalizeVariantPromotionKey } from "@/lib/affiliate-storefront-variants"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import { findColorImageRowForName } from "@/lib/product-color-images"

export type AffiliateVariantPresentationEntry = {
  /** Shopper-facing label (e.g. "Noir Mat" instead of "Variant 3") */
  label?: string
  /** HTTPS / data URL hero for this variant key */
  image?: string
}

export type AffiliateVariantPresentationMap = Record<string, AffiliateVariantPresentationEntry>

const MAX_KEYS = 80
const MAX_LABEL = 64

function normKey(key: string): string {
  return normalizeVariantPromotionKey(key)
}

export function parseAffiliateVariantPresentationJson(raw: unknown): AffiliateVariantPresentationMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: AffiliateVariantPresentationMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normKey(k)
    if (!key || !v || typeof v !== "object" || Array.isArray(v)) continue
    const row = v as Record<string, unknown>
    const labelRaw = typeof row.label === "string" ? row.label.trim().slice(0, MAX_LABEL) : ""
    const imageRaw =
      typeof row.image === "string" ? trimColorSwatchImageForStore(row.image.trim()) : ""
    if (!labelRaw && !imageRaw) continue
    out[key] = {
      ...(labelRaw ? { label: labelRaw } : {}),
      ...(imageRaw ? { image: imageRaw } : {}),
    }
    if (Object.keys(out).length >= MAX_KEYS) break
  }
  return out
}

/** Persist only non-empty overrides for allowed keys (idempotent empty → null). */
export function serializeVariantPresentationForDb(
  map: AffiliateVariantPresentationMap,
  allowedKeys: string[]
): AffiliateVariantPresentationMap | null {
  const allow = new Set(allowedKeys.map((k) => normKey(k).toLowerCase()))
  const out: AffiliateVariantPresentationMap = {}
  for (const [k, v] of Object.entries(map)) {
    const key = normKey(k)
    if (!key || !allow.has(key.toLowerCase())) continue
    const label = v.label?.trim().slice(0, MAX_LABEL) || ""
    const image = v.image ? trimColorSwatchImageForStore(v.image.trim()) : ""
    if (!label && !image) continue
    out[key] = {
      ...(label ? { label } : {}),
      ...(image ? { image } : {}),
    }
    if (Object.keys(out).length >= MAX_KEYS) break
  }
  return Object.keys(out).length > 0 ? out : null
}

export function lookupVariantPresentation(
  map: AffiliateVariantPresentationMap,
  key: string
): AffiliateVariantPresentationEntry | null {
  const want = normKey(key)
  if (!want) return null
  if (map[want]) return map[want]!
  const lower = want.toLowerCase()
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v
  }
  return null
}

export function resolveVariantDisplayLabel(
  map: AffiliateVariantPresentationMap,
  stableKey: string,
  fallback: string
): string {
  const entry = lookupVariantPresentation(map, stableKey)
  const label = entry?.label?.trim()
  return label || fallback
}

/** Overlay affiliate photos onto product colorImages (stable color keys unchanged). */
export function applyVariantPresentationToColorImages(
  colorImages: ProductColorImageRow[],
  presentation: AffiliateVariantPresentationMap
): ProductColorImageRow[] {
  if (!colorImages.length || Object.keys(presentation).length === 0) return colorImages
  return colorImages.map((row) => {
    const entry = lookupVariantPresentation(presentation, row.color)
    const img = entry?.image?.trim()
    if (!img) return row
    return { ...row, image: img }
  })
}

/** Build display-label map for PDP swatches (stable name → custom label). */
export function variantPresentationDisplayLabels(
  presentation: AffiliateVariantPresentationMap,
  colorNames: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of colorNames) {
    const label = lookupVariantPresentation(presentation, name)?.label?.trim()
    if (label) out[name] = label
  }
  return out
}

/** Ensure colorImages rows exist for presentation keys that only have an image override. */
export function mergePresentationImagesIntoColorRows(
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  presentation: AffiliateVariantPresentationMap
): ProductColorImageRow[] {
  const applied = applyVariantPresentationToColorImages(colorImages, presentation)
  if (colorNames.length === 0) return applied
  const byLower = new Map(applied.map((r) => [r.color.toLowerCase(), r]))
  const out = [...applied]
  for (const name of colorNames) {
    const entry = lookupVariantPresentation(presentation, name)
    const img = entry?.image?.trim()
    if (!img) continue
    const existing = findColorImageRowForName(out, name)
    if (existing) {
      if (!existing.image) existing.image = img
      continue
    }
    if (byLower.has(name.toLowerCase())) continue
    out.push({ color: name, hex: "#8E8E93", image: img })
  }
  return out
}

export function parseVariantPresentationBody(
  raw: unknown,
  allowedKeys: string[]
): { ok: true; value: AffiliateVariantPresentationMap | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null }
  if (raw === undefined) return { ok: true, value: null }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid variantPresentation" }
  }
  const parsed = parseAffiliateVariantPresentationJson(raw)
  return { ok: true, value: serializeVariantPresentationForDb(parsed, allowedKeys) }
}
