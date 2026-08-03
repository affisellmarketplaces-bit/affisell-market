/**
 * Client-safe helpers: map AE / supplier variant metadata → shopper-facing labels.
 * Stable keys (e.g. "Variant 3") stay unchanged for pricing / presentation maps.
 */

export function isPlaceholderVariantColor(name: string): boolean {
  return /^V(ariant)?\s*\d+$/i.test(name.trim())
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
    const fromAe = aeLabel.split(/[·|]/)[0]?.trim() ?? ""
    const candidate = (fromAttr || fromAe).replace(/\s+/g, " ").trim().slice(0, 48)
    if (candidate && !isPlaceholderVariantColor(candidate)) {
      colorLabel = candidate
    } else if (candidate) {
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
