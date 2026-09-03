import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"
import { absolutizeCdnImageUrl, collectAbsolutizedImageUrls } from "@/lib/cdn-image-url"
import { stripDescriptionImageMarkers } from "@/lib/description-rich-content"
import {
  parseAeProductSpecsFromPayload,
  specsToDescriptionBullets,
} from "@/lib/fulfillment/ae-product-specs"
import { extractHtmlDescriptionContent } from "@/lib/html-description-extract"

export type AliExpressMappedProduct = {
  aliexpressProductId: string
  name: string
  description: string
  descriptionIllustrationImages: string[]
  /** Gallery + SKU swatches + description illustrations (absolutized https) */
  images: string[]
  basePriceCents: number
  stock: number
  brand: string
  specs: Record<string, string>
  videos: string[]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return ""
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
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

  const fromResult = pickString(result, [
    "target_sale_price",
    "sale_price",
    "product_price",
  ])

  const raw = fromSku || fromResult
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(",", "."))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

function parseStock(sku: Record<string, unknown>, result: Record<string, unknown>): number {
  const raw =
    sku.sku_available_stock ??
    sku.available_stock ??
    sku.stock ??
    result.total_avail_quantity ??
    result.total_available_stock
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function mergeImageLists(...lists: string[][]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const u of list) {
      const abs = absolutizeCdnImageUrl(u)
      if (!abs || seen.has(abs)) continue
      seen.add(abs)
      out.push(abs)
      if (out.length >= 40) return out
    }
  }
  return out
}

/** Pull protocol-relative SKU swatch URLs without importing ae-product-skus (circular). */
function collectSkuImageUrls(result: Record<string, unknown>): string[] {
  const skus = parseSkuList(
    result.ae_item_sku_info_dtos ??
      result.ae_item_sku_info_dto ??
      result.sku_info ??
      result.skus
  )
  const out: string[] = []
  for (const sku of skus) {
    const root = pickString(sku, ["sku_image", "sku_img", "sku_image_url", "image", "image_url"])
    if (root) out.push(root)
    const rawProps =
      sku.ae_sku_property_dtos ??
      sku.ae_sku_property_dto ??
      sku.sku_property_list ??
      sku.sku_props
    const propList = Array.isArray(rawProps) ? rawProps : rawProps ? [rawProps] : []
    for (const p of propList) {
      const rec = asRecord(p)
      if (!rec) continue
      const img = pickString(rec, [
        "sku_image",
        "sku_property_image_path",
        "sku_image_url",
        "image",
        "image_url",
        "skuPropertyImagePath",
      ])
      if (img) out.push(img)
    }
  }
  return out
}

function brandFromSpecs(specs: Record<string, string>): string {
  for (const [k, v] of Object.entries(specs)) {
    if (!v.trim()) continue
    if (/^brand(_name)?$/i.test(k) || /marque/i.test(k)) {
      if (/^none$/i.test(v) || /n\/?a/i.test(v)) return ""
      return v.trim().slice(0, 48)
    }
  }
  return ""
}

function appendCharacteristics(description: string, specs: Record<string, string>): string {
  const parts: string[] = [description.trim()].filter(Boolean)
  const bullets = specsToDescriptionBullets(
    Object.entries(specs).map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    })),
    40
  )
  if (bullets.length > 0 && !/CARACTÉRISTIQUES|CHARACTERISTICS/i.test(description)) {
    parts.push(`CARACTÉRISTIQUES\n${bullets.map((b) => `• ${b}`).join("\n")}`)
  }
  return parts.join("\n\n").slice(0, 20_000)
}

/** Map `aliexpress.ds.product.get` JSON to Affisell product fields. */
export function mapAliExpressGetProductResponse(
  payload: unknown,
  productId: string
): AliExpressMappedProduct {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}

  const base =
    asRecord(result.ae_item_base_info_dto) ??
    asRecord(result.ae_item_base_info) ??
    asRecord(result.base_info_dto) ??
    result

  const media =
    asRecord(result.ae_multimedia_info_dto) ??
    asRecord(result.ae_multimedia_info) ??
    asRecord(result.multimedia_info_dto) ??
    {}

  const subject =
    pickString(base, ["subject", "product_title", "title", "product_name"]) ||
    pickString(result, ["subject", "product_title"])

  const gallery = collectAbsolutizedImageUrls(
    media.image_urls ??
      media.image_url_list ??
      media.image_list ??
      result.image_urls ??
      base.image_urls,
    24
  )

  const skus = parseSkuList(
    result.ae_item_sku_info_dtos ??
      result.ae_item_sku_info_dto ??
      result.sku_info ??
      result.skus
  )
  const firstSku = skus[0] ?? {}

  const skuPrices = skus
    .map((sku) => parsePriceEur(sku, result))
    .filter((p) => p > 0)
  const priceEur =
    skuPrices.length > 0 ? Math.min(...skuPrices) : parsePriceEur(firstSku, result)
  const stock =
    skus.length > 0
      ? Math.max(...skus.map((sku) => parseStock(sku, result)).filter((s) => s > 0), 0) ||
        parseStock(firstSku, result)
      : parseStock(firstSku, result)

  const descriptionRaw =
    pickString(base, ["detail", "product_description", "description"]) ||
    `Imported from AliExpress product ${productId}.`
  // Express / plain textareas must never see [[img:N]] — photos live in gallery + illustrationImages
  const extracted = extractHtmlDescriptionContent(descriptionRaw, { insertImageMarkers: false })
  const illustrationImages = (extracted.imageUrls ?? [])
    .map((u) => absolutizeCdnImageUrl(u) ?? u)
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 40)

  const skuImages = collectAbsolutizedImageUrls(collectSkuImageUrls(result), 24)
  const images = mergeImageLists(gallery, skuImages, illustrationImages)

  const specRows = parseAeProductSpecsFromPayload(payload)
  const specs: Record<string, string> = {}
  for (const row of specRows) {
    if (row.value.trim()) specs[row.key] = row.value.trim()
  }

  const videoRaw =
    media.video_urls ?? media.video_url_list ?? media.video_url ?? result.video_urls
  const videos = collectAbsolutizedImageUrls(videoRaw, 3).filter(
    (u) => /\.(mp4|webm|m3u8)(\?|$)/i.test(u) || /video/i.test(u)
  )

  if (!subject) {
    throw new Error("AliExpress product has no title")
  }
  if (priceEur <= 0) {
    throw new Error("AliExpress product price not found — confirm EUR/FR locale on the API app")
  }

  const brand = brandFromSpecs(specs)
  const baseDescription = stripDescriptionImageMarkers(
    extracted.text || descriptionRaw.replace(/<[^>]+>/g, " ").trim()
  ).slice(0, 12_000)

  return {
    aliexpressProductId: productId,
    name: subject.slice(0, 500),
    description: appendCharacteristics(baseDescription, specs),
    descriptionIllustrationImages: illustrationImages.slice(0, 40),
    images,
    basePriceCents: Math.max(100, Math.round(priceEur * 100)),
    stock: stock > 0 ? stock : 1,
    brand,
    specs,
    videos,
  }
}
