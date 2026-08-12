import { VARIANT_COLOR_REGEX } from "@/lib/supplier-sku-builder"

/** AE often exposes property ids ("771", "1") instead of shopper labels. */
export function isNumericOnlyVariantToken(raw: string): boolean {
  return /^\d+$/.test(raw.trim())
}

/** Strip AE sku_attr noise: `14:771#55mm Blue` → `55mm Blue`. */
export function stripAeSkuTechnicalLabel(raw: string): string {
  let s = raw.trim()
  if (!s) return s

  const hashParts = s.split("#").map((p) => p.trim()).filter(Boolean)
  if (hashParts.length > 1) {
    const tail = hashParts.slice(1).join(" ").trim()
    if (tail && !isNumericOnlyVariantToken(tail)) return tail
  }

  return s
    .replace(/\d+:\d+#?/gi, " ")
    .replace(/[#*_]+/g, " ")
    .replace(/[·•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Human labels embedded in AE `sku_attr` after `#`. */
export function humanLabelFromAeSkuAttr(skuAttr: string): string | null {
  if (!skuAttr.trim()) return null
  const parts: string[] = []
  for (const segment of skuAttr.split(";")) {
    const trimmed = segment.trim()
    const hash = trimmed.indexOf("#")
    if (hash >= 0) {
      const label = stripAeSkuTechnicalLabel(trimmed.slice(hash + 1))
      if (label && !isNumericOnlyVariantToken(label)) parts.push(label)
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

function pickColorFromAttributes(attrs?: Record<string, string>): string | null {
  if (!attrs) return null
  for (const key of [
    "Couleur",
    "Color",
    "couleur",
    "color",
    "Colour",
    "colour",
    "Couleurs",
    "Colors",
  ]) {
    const v = attrs[key]?.trim()
    if (v && !isNumericOnlyVariantToken(v)) return v
  }
  for (const v of Object.values(attrs)) {
    const t = v?.trim()
    if (t && !isNumericOnlyVariantToken(t)) return t
  }
  return null
}

/** Resolve the shopper-facing variant label from AE SKU metadata. */
export function resolveAeVariantDisplayColor(
  sku: {
    aeLabel: string
    matchColor?: string | null
    attributes?: Record<string, string>
  },
  index: number
): string {
  const fromAttrs = pickColorFromAttributes(sku.attributes)
  if (fromAttrs) return fromAttrs

  if (
    sku.matchColor &&
    sku.matchColor !== "default" &&
    !isNumericOnlyVariantToken(sku.matchColor)
  ) {
    return sku.matchColor
  }

  for (const part of sku.aeLabel.split(/[·|]/)) {
    const cleaned = stripAeSkuTechnicalLabel(part)
    if (cleaned && !isNumericOnlyVariantToken(cleaned)) return cleaned
  }

  const fromSkuAttr = humanLabelFromAeSkuAttr(sku.aeLabel)
  if (fromSkuAttr) return fromSkuAttr

  const cleanedLabel = stripAeSkuTechnicalLabel(sku.aeLabel)
  if (cleanedLabel && !isNumericOnlyVariantToken(cleanedLabel)) return cleanedLabel

  const bareLabel = sku.aeLabel.trim()
  if (/^\d+$/.test(bareLabel)) return bareLabel
  const numericAttr =
    sku.attributes?.Couleur?.trim() ||
    sku.attributes?.Color?.trim() ||
    sku.attributes?.couleur?.trim() ||
    sku.attributes?.color?.trim()
  if (numericAttr && /^\d+$/.test(numericAttr)) return numericAttr

  return `Variant ${index + 1}`
}

/** Normalize for DB color column while preserving human labels like `55mm Blue`. */
export function normalizeAeVariantColorLabel(raw: string, index: number): string {
  let c = stripAeSkuTechnicalLabel(raw)
    .replace(/[,+]+/g, " ")
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
