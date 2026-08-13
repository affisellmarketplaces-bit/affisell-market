import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import {
  buildSkuPropertyLookupFromApiPayload,
  findImageByDisplayNameInLookup,
  labelsFromSkuAttr,
  preferHumanAeLabel,
} from "@/lib/fulfillment/ae-sku-property-lookup"
import { isNumericOnlyVariantToken } from "@/lib/fulfillment/ae-variant-display-name"
import { normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"
import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"
import { hydrateAeSkuRowImages } from "@/lib/fulfillment/ae-sku-image-hydrate"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"
import type { AeSkuPropValueMeta } from "@/lib/fulfillment/ae-sku-property-lookup"

export type AeProductSkuRow = {
  aeSkuId: string
  aeLabel: string
  matchColor: string | null
  matchSize: string | null
  aePriceCents: number
  stock: number
  /** Color / option swatch image when AE exposes it */
  imageUrl?: string | null
  /** Raw property map e.g. { Couleur: "55mm Blue" } */
  attributes?: Record<string, string>
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return ""
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function absolutizeImage(raw: string): string | null {
  if (!raw) return null
  return absolutizeCdnImageUrl(raw) ?? null
}

function parseSkuList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
  }
  const rec = asRecord(raw)
  if (!rec) return []
  const nested =
    rec.ae_item_sku_info_d_t_o ??
    rec.ae_item_sku_info_dto ??
    rec.ae_item_sku_info ??
    rec.sku_info
  if (Array.isArray(nested)) {
    return nested.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
  }
  const one = asRecord(nested)
  return one ? [one] : []
}

function parsePriceEur(sku: Record<string, unknown>, result: Record<string, unknown>): number {
  const fromSku =
    pickString(sku, [
      "offer_sale_price",
      "sku_price",
      "target_offer_sale_price",
      "sale_price",
      "price",
    ]) ||
    String(sku.offer_sale_price ?? sku.sku_price ?? sku.target_offer_sale_price ?? "")

  const fromResult = pickString(result, ["target_sale_price", "sale_price", "product_price"])
  const raw = fromSku || fromResult
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(",", "."))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

function parseSkuPropertyDtos(
  sku: Record<string, unknown>
): {
  parts: string[]
  attributes: Record<string, string>
  color: string | null
  size: string | null
  imageUrl: string | null
} {
  const parts: string[] = []
  const attributes: Record<string, string> = {}
  let color: string | null = null
  let size: string | null = null
  let imageUrl: string | null = null

  const rawProps =
    sku.ae_sku_property_dtos ??
    sku.ae_sku_property_dto ??
    sku.sku_property_list ??
    sku.sku_props

  const propList = Array.isArray(rawProps) ? rawProps : rawProps ? [rawProps] : []

  for (const p of propList) {
    const rec = asRecord(p)
    if (!rec) continue
    const name = pickString(rec, [
      "sku_property_name",
      "property_name",
      "name",
      "spec_name",
    ])
    const nameLower = name.toLowerCase()
    const value = pickString(rec, [
      "property_value_definition_name",
      "property_value_display_name",
      "propertyValueDisplayName",
      "sku_property_value_name",
      "sku_property_value",
      "property_value",
      "value",
      "spec_value",
    ])
    if (!value) continue
    if (!isNumericOnlyVariantToken(value)) {
      parts.push(value)
    }
    if (name) attributes[name] = value
    const isColorProp =
      nameLower.includes("color") ||
      nameLower.includes("couleur") ||
      nameLower === "color"
    const isSizeProp = nameLower.includes("size") || nameLower.includes("taille")
    if (!color && isColorProp && !isNumericOnlyVariantToken(value)) {
      color = value
    }
    if (!size && isSizeProp && !isNumericOnlyVariantToken(value)) {
      size = value
    }
    if (!imageUrl) {
      const img = pickString(rec, [
        "sku_image",
        "sku_property_image_path",
        "skuPropertyImagePath",
        "skuPropertyImageSummPath",
        "sku_property_image_summ_path",
        "property_value_image_url",
        "propertyValueImageUrl",
        "sku_image_url",
        "image",
        "image_url",
      ])
      if (img) imageUrl = absolutizeImage(img)
    }
  }

  if (!imageUrl) {
    const rootImg = pickString(sku, [
      "sku_image",
      "sku_img",
      "sku_image_url",
      "skuPropertyImagePath",
      "skuPropertyImageSummPath",
      "image",
      "image_url",
    ])
    if (rootImg) imageUrl = absolutizeImage(rootImg)
  }

  return { parts, attributes, color, size, imageUrl }
}

function parseSkuRow(
  sku: Record<string, unknown>,
  lookup: Map<string, AeSkuPropValueMeta>
): {
  color: string | null
  size: string | null
  label: string
  imageUrl: string | null
  attributes: Record<string, string>
} {
  const skuAttr = pickString(sku, ["sku_attr", "skuAttr"])
  const fromDtos = parseSkuPropertyDtos(sku)

  if (skuAttr) {
    const fromAttr = labelsFromSkuAttr(skuAttr, lookup)
    const attributes = { ...fromDtos.attributes, ...fromAttr.attributes }
    const label = preferHumanAeLabel(fromAttr.parts, skuAttr)
    const color =
      fromAttr.color ||
      fromDtos.color ||
      (fromAttr.parts.length === 1 ? fromAttr.parts[0] ?? null : null)
    const size = fromAttr.size || fromDtos.size
    let imageUrl = fromAttr.imageUrl || fromDtos.imageUrl

    if (!imageUrl && skuAttr) {
      for (const segment of skuAttr.split(";")) {
        const parsed = segment.trim()
        const colon = parsed.indexOf(":")
        if (colon <= 0) continue
        const propId = parsed.slice(0, colon).trim()
        let valuePart = parsed.slice(colon + 1).trim()
        const hash = valuePart.indexOf("#")
        if (hash >= 0) valuePart = valuePart.slice(0, hash).trim()
        const meta = lookup.get(`${propId}:${valuePart}`)
        if (meta?.imageUrl) {
          imageUrl = meta.imageUrl
          break
        }
      }
    }

    if (!imageUrl) {
      imageUrl = findImageByDisplayNameInLookup(lookup, label)
    }

    return { color, size, label, imageUrl, attributes }
  }

  const label = preferHumanAeLabel(fromDtos.parts, null)
  let color = fromDtos.color
  if (!color && fromDtos.parts.length === 1 && !isNumericOnlyVariantToken(fromDtos.parts[0] ?? "")) {
    color = fromDtos.parts[0] ?? null
  }

  return {
    color,
    size: fromDtos.size,
    label,
    imageUrl: fromDtos.imageUrl,
    attributes: fromDtos.attributes,
  }
}

/** Parse all SKUs from `aliexpress.ds.product.get` payload. */
export function parseAeProductSkusFromPayload(payload: unknown, aeProductId: string): AeProductSkuRow[] {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}

  const skus = parseSkuList(
    result.ae_item_sku_info_dtos ??
      result.ae_item_sku_info_dto ??
      result.sku_info ??
      result.skus
  )

  const lookup = buildSkuPropertyLookupFromApiPayload(result, skus)
  const rows: AeProductSkuRow[] = []

  for (const sku of skus) {
    const rawId =
      pickString(sku, ["sku_id", "skuId", "ae_sku_id"]) ||
      (sku.sku_id != null ? String(sku.sku_id) : "")
    const aeSkuId = normalizeAeSkuCandidate(rawId) ?? ""
    if (!aeSkuId) continue

    const { color, size, label, imageUrl, attributes } = parseSkuRow(sku, lookup)
    const priceEur = parsePriceEur(sku, result)
    const stockRaw = sku.sku_available_stock ?? sku.available_stock ?? sku.stock
    const stock = Math.max(0, Math.round(Number(stockRaw)) || 0)

    rows.push({
      aeSkuId,
      aeLabel: label,
      matchColor: color ? canonicalVariantColorKey(color) : null,
      matchSize: size?.trim() || null,
      aePriceCents: priceEur > 0 ? Math.max(100, Math.round(priceEur * 100)) : 0,
      stock,
      imageUrl,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    })
  }

  if (rows.length === 0) {
    try {
      const mapped = mapAliExpressGetProductResponse(payload, aeProductId)
      rows.push({
        aeSkuId: "",
        aeLabel: "Défaut",
        matchColor: null,
        matchSize: null,
        aePriceCents: mapped.basePriceCents,
        stock: mapped.stock,
      })
    } catch {
      /* no skus */
    }
  }

  return hydrateAeSkuRowImages(rows, { lookup })
}
