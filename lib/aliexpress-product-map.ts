import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"

export type AliExpressMappedProduct = {
  aliexpressProductId: string
  name: string
  description: string
  images: string[]
  basePriceCents: number
  stock: number
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

function parseImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim())
      .slice(0, 12)
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[;,]/)
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
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

  const images = parseImageUrls(
    media.image_urls ??
      media.image_url_list ??
      result.image_urls ??
      base.image_urls
  )

  const skus = parseSkuList(
    result.ae_item_sku_info_dtos ??
      result.ae_item_sku_info_dto ??
      result.sku_info ??
      result.skus
  )
  const firstSku = skus[0] ?? {}

  const priceEur = parsePriceEur(firstSku, result)
  const stock = parseStock(firstSku, result)

  const description =
    pickString(base, ["detail", "product_description", "description"]) ||
    `Imported from AliExpress product ${productId}.`

  if (!subject) {
    throw new Error("AliExpress product has no title")
  }
  if (priceEur <= 0) {
    throw new Error("AliExpress product price not found — confirm EUR/FR locale on the API app")
  }

  return {
    aliexpressProductId: productId,
    name: subject.slice(0, 500),
    description: description.slice(0, 20_000),
    images,
    basePriceCents: Math.max(100, Math.round(priceEur * 100)),
    stock: stock > 0 ? stock : 1,
  }
}
