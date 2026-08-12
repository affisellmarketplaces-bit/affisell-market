/**
 * Client-safe helpers: map AE / supplier variant metadata → shopper-facing labels.
 * Stable keys (e.g. "Variant 3") stay unchanged for pricing / presentation maps.
 */

import {
  isNumericOnlyVariantToken,
  stripAeSkuTechnicalLabel,
} from "@/lib/fulfillment/ae-variant-display-name"

export function isPlaceholderVariantColor(name: string): boolean {
  const t = name.trim()
  if (/^V(ariant)?\s*\d+$/i.test(t)) return true
  return isNumericOnlyVariantToken(t)
}

function pickAttrString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = data[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

/** Prefer real Couleur / Color / aeLabel over sanitized "Variant N". */
export function shopperLabelFromVariantCustomData(
  stableKey: string,
  customData: unknown,
  sizeHint?: string | null
): string {
  const key = stableKey.trim()
  if (!key) return key

  const slash = key.indexOf(" / ")
  const colorPart = slash >= 0 ? key.slice(0, slash).trim() : key
  const sizePart =
    (typeof sizeHint === "string" && sizeHint.trim() ? sizeHint.trim() : null) ||
    (slash >= 0 ? key.slice(slash + 3).trim() : null)

  let colorLabel = colorPart
  if (isPlaceholderVariantColor(colorPart) && customData && typeof customData === "object" && !Array.isArray(customData)) {
    const d = customData as Record<string, unknown>
    const fromAttr = pickAttrString(d, [
      "Couleur",
      "Color",
      "couleur",
      "color",
      "Colour",
      "colour",
      "Couleurs",
      "Colors",
    ])
    const aeLabel = typeof d.aeLabel === "string" ? d.aeLabel.trim() : ""
    const fromAeParts = aeLabel
      .split(/[·|]/)
      .map((p) => stripAeSkuTechnicalLabel(p))
      .filter((p) => p && !isNumericOnlyVariantToken(p) && !isPlaceholderVariantColor(p))
    const fromAe = fromAeParts[0] ?? stripAeSkuTechnicalLabel(aeLabel.split(/[·|]/)[0] ?? "")
    const candidate = (fromAttr || fromAe).replace(/\s+/g, " ").trim().slice(0, 48)
    if (candidate && !isPlaceholderVariantColor(candidate)) {
      colorLabel = candidate
    } else if (candidate && !isNumericOnlyVariantToken(candidate)) {
      colorLabel = candidate
    }
  }

  if (sizePart) return `${colorLabel} / ${sizePart}`
  return colorLabel
}

export function variantImageFromCustomData(customData: unknown): string {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return ""
  const img = (customData as Record<string, unknown>).image
  return typeof img === "string" && /^https?:\/\//i.test(img.trim()) ? img.trim() : ""
}
