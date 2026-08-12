import {
  humanLabelFromAeSkuAttr,
  isNumericOnlyVariantToken,
  stripAeSkuTechnicalLabel,
} from "@/lib/fulfillment/ae-variant-display-name"

export type AeSkuPropValueMeta = {
  propName: string
  displayName: string
  imageUrl: string | null
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function txt(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return ""
}

function absolutizeImage(raw: string): string | null {
  if (!raw) return null
  const abs = raw.startsWith("//") ? `https:${raw}` : raw
  return /^https?:\/\//i.test(abs) ? abs : null
}

function pickDisplayName(rec: Record<string, unknown>): string {
  return (
    txt(rec.property_value_definition_name) ||
    txt(rec.property_value_display_name) ||
    txt(rec.propertyValueDisplayName) ||
    txt(rec.sku_property_value_name) ||
    txt(rec.propertyValueName) ||
    txt(rec.name) ||
    ""
  )
}

function pickImage(rec: Record<string, unknown>): string | null {
  const raw =
    txt(rec.sku_property_image_path) ||
    txt(rec.skuPropertyImagePath) ||
    txt(rec.sku_image) ||
    txt(rec.sku_image_url) ||
    txt(rec.image) ||
    txt(rec.image_url)
  return raw ? absolutizeImage(raw) : null
}

function ingestPropertyValue(
  out: Map<string, AeSkuPropValueMeta>,
  propId: string,
  propName: string,
  valueRec: Record<string, unknown>
): void {
  const valueId =
    txt(valueRec.property_value_id) ||
    txt(valueRec.propertyValueId) ||
    txt(valueRec.value_id) ||
    txt(valueRec.sku_property_value_id)
  const displayFromField = pickDisplayName(valueRec)
  const fallbackValueId = txt(valueRec.sku_property_value) || txt(valueRec.property_value)
  const displayName =
    displayFromField && !isNumericOnlyVariantToken(displayFromField)
      ? displayFromField
      : fallbackValueId && !isNumericOnlyVariantToken(fallbackValueId)
        ? fallbackValueId
        : displayFromField || fallbackValueId

  if (!propId || !valueId || !displayName) return
  const imageUrl = pickImage(valueRec)
  const key = `${propId}:${valueId}`
  const existing = out.get(key)
  if (existing) {
    if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl
    if (isNumericOnlyVariantToken(existing.displayName) && !isNumericOnlyVariantToken(displayName)) {
      existing.displayName = displayName
    }
    return
  }
  out.set(key, { propName, displayName, imageUrl })
}

/** HTML `productSKUPropertyList` lookup (`14:771` → `55mm Blue`). */
export function buildSkuPropertyLookupFromPageModule(
  skuModule: Record<string, unknown>
): Map<string, AeSkuPropValueMeta> {
  const out = new Map<string, AeSkuPropValueMeta>()
  const props = Array.isArray(skuModule.productSKUPropertyList)
    ? skuModule.productSKUPropertyList
    : []

  for (const propRaw of props) {
    const prop = asRec(propRaw)
    if (!prop) continue
    const propId = txt(prop.skuPropertyId) || txt(prop.propertyId) || txt(prop.sku_property_id)
    const propName = txt(prop.skuPropertyName) || txt(prop.propertyName) || txt(prop.sku_property_name) || "Option"
    const values = Array.isArray(prop.skuPropertyValues)
      ? prop.skuPropertyValues
      : Array.isArray(prop.sku_property_values)
        ? prop.sku_property_values
        : []
    for (const vRaw of values) {
      const v = asRec(vRaw)
      if (v) ingestPropertyValue(out, propId, propName, v)
    }
  }

  return out
}

function ingestPropertyDto(out: Map<string, AeSkuPropValueMeta>, rec: Record<string, unknown>): void {
  const propId =
    txt(rec.sku_property_id) ||
    txt(rec.property_id) ||
    txt(rec.skuPropertyId) ||
    txt(rec.propertyId)
  const propName =
    txt(rec.sku_property_name) ||
    txt(rec.property_name) ||
    txt(rec.skuPropertyName) ||
    txt(rec.propertyName) ||
    "Option"
  const valueId =
    txt(rec.property_value_id) ||
    txt(rec.propertyValueId) ||
    txt(rec.sku_property_value_id)
  if (propId && valueId) {
    ingestPropertyValue(out, propId, propName, rec)
    return
  }
  const nestedValues = Array.isArray(rec.sku_property_value_list)
    ? rec.sku_property_value_list
    : Array.isArray(rec.ae_sku_property_value_dtos)
      ? rec.ae_sku_property_value_dtos
      : []
  for (const vRaw of nestedValues) {
    const v = asRec(vRaw)
    if (v) ingestPropertyValue(out, propId, propName, v)
  }
}

/** Aggregate lookup from `aliexpress.ds.product.get` SKU property DTOs. */
export function buildSkuPropertyLookupFromApiPayload(
  result: Record<string, unknown>,
  skus: Record<string, unknown>[]
): Map<string, AeSkuPropValueMeta> {
  const out = new Map<string, AeSkuPropValueMeta>()

  const rootLists = [
    result.ae_sku_property_dtos,
    result.ae_sku_property_dto,
    result.sku_property_list,
    asRec(result.ae_item_sku_info_dtos)?.ae_sku_property_dtos,
  ]
  for (const raw of rootLists) {
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    for (const item of list) {
      const rec = asRec(item)
      if (rec) ingestPropertyDto(out, rec)
    }
  }

  for (const sku of skus) {
    const rawProps =
      sku.ae_sku_property_dtos ??
      sku.ae_sku_property_dto ??
      sku.sku_property_list ??
      sku.sku_props
    const propList = Array.isArray(rawProps) ? rawProps : rawProps ? [rawProps] : []
    for (const p of propList) {
      const rec = asRec(p)
      if (rec) ingestPropertyDto(out, rec)
    }
  }

  return out
}

export function parseSkuAttrSegment(segment: string): { propId: string; valueId: string } | null {
  const trimmed = segment.trim()
  if (!trimmed) return null
  const colon = trimmed.indexOf(":")
  if (colon <= 0) return null
  const propId = trimmed.slice(0, colon).trim()
  let valuePart = trimmed.slice(colon + 1).trim()
  const hash = valuePart.indexOf("#")
  if (hash >= 0) valuePart = valuePart.slice(0, hash).trim()
  if (!propId || !valuePart) return null
  return { propId, valueId: valuePart }
}

/** Resolve human labels + swatch images from AE `sku_attr` string. */
export function labelsFromSkuAttr(
  skuAttr: string,
  lookup: Map<string, AeSkuPropValueMeta>
): {
  parts: string[]
  attributes: Record<string, string>
  color: string | null
  size: string | null
  imageUrl: string | null
} {
  const attributes: Record<string, string> = {}
  const parts: string[] = []
  let color: string | null = null
  let size: string | null = null
  let imageUrl: string | null = null

  for (const segment of skuAttr.split(";")) {
    const trimmed = segment.trim()
    const hashIdx = trimmed.indexOf("#")
    const inlineHuman =
      hashIdx >= 0 ? stripAeSkuTechnicalLabel(trimmed.slice(hashIdx + 1)) : ""

    const parsed = parseSkuAttrSegment(segment)
    if (!parsed) {
      if (inlineHuman) {
        attributes.Option = inlineHuman
        parts.push(inlineHuman)
        if (!color) color = inlineHuman
      }
      continue
    }
    const meta = lookup.get(`${parsed.propId}:${parsed.valueId}`)
    if (meta) {
      attributes[meta.propName] = meta.displayName
      parts.push(meta.displayName)
      const propLower = meta.propName.toLowerCase()
      if (!color && (propLower.includes("color") || propLower.includes("couleur"))) {
        color = meta.displayName
        if (meta.imageUrl) imageUrl = meta.imageUrl
      }
      if (!size && (propLower.includes("size") || propLower.includes("taille"))) {
        size = meta.displayName
      }
      if (
        !imageUrl &&
        meta.imageUrl &&
        (propLower.includes("color") || propLower.includes("couleur"))
      ) {
        imageUrl = meta.imageUrl
      }
    } else if (inlineHuman) {
      attributes[`Option ${parsed.propId}`] = inlineHuman
      parts.push(inlineHuman)
      if (!color) color = inlineHuman
    }
  }

  if (!color && parts.length === 1) color = parts[0] ?? null

  return { parts, attributes, color, size, imageUrl }
}

export function preferHumanAeLabel(parts: string[], skuAttr: string | null): string {
  const fromSkuAttr = skuAttr ? humanLabelFromAeSkuAttr(skuAttr) : null
  if (fromSkuAttr) return fromSkuAttr
  const humanParts = parts
    .map((p) => stripAeSkuTechnicalLabel(p))
    .filter((p) => p && !isNumericOnlyVariantToken(p))
  if (humanParts.length > 0) return humanParts.join(" · ")
  if (parts.length > 0) return parts.join(" · ")
  return skuAttr?.trim() || "SKU"
}
