import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { parseAeProductSkusFromPayload } from "@/lib/fulfillment/ae-product-skus"
import {
  AliExpressApiError,
  AliExpressClient,
  createAliExpressClient,
  unwrapAliExpressMethodResponse,
} from "@/lib/aliexpress-open-api"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

export type ResolvedSupplierLinkFields = {
  aeProductId: string
  aeSkuId: string | null
  aeShopId: string
  aePriceCents: number
  aeShippingCents: number
  aeUrl: string
  aeSkus?: import("@/lib/fulfillment/ae-product-skus").AeProductSkuRow[]
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

function normalizeAeUrl(productId: string, input?: string): string {
  const trimmed = input?.trim()
  if (trimmed && trimmed.includes("aliexpress")) return trimmed
  return `https://www.aliexpress.com/item/${productId}.html`
}

function parseShopId(payload: unknown): string {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}
  const store =
    asRecord(result.ae_store_info) ??
    asRecord(result.store_info) ??
    asRecord(result.ae_store_info_dto) ??
    {}
  return (
    pickString(store, ["store_id", "storeId", "shop_id", "shopId"]) ||
    pickString(result, ["store_id", "storeId", "shop_id", "shopId", "seller_id", "sellerId"])
  )
}

function parseFirstSkuId(payload: unknown): string | null {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}
  const raw =
    result.ae_item_sku_info_dtos ??
    result.ae_item_sku_info_dto ??
    result.sku_info ??
    result.skus
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  for (const item of list) {
    const sku = asRecord(item)
    const id =
      pickString(sku, ["sku_id", "skuId", "ae_sku_id", "id"]) ||
      (sku?.sku_id != null ? String(sku.sku_id) : "")
    if (id) return id
  }
  return null
}

/** Resolve AliExpress URL or product id → supplier link fields (Open API when configured). */
export async function resolveSupplierLinkFromAeInput(
  input: string
): Promise<ResolvedSupplierLinkFields> {
  const aeProductId = parseAliExpressProductId(input)
  if (!aeProductId) {
    throw new AliExpressApiError("Invalid AliExpress URL or product id")
  }

  const aeUrl = normalizeAeUrl(aeProductId, input)

  if (!AliExpressClient.isConfigured()) {
    return {
      aeProductId,
      aeSkuId: null,
      aeShopId: "",
      aePriceCents: 0,
      aeShippingCents: 0,
      aeUrl,
    }
  }

  const client = await createAliExpressClient()
  const raw = await client.getProduct(aeProductId)
  const mapped = mapAliExpressGetProductResponse(raw, aeProductId)
  const aeSkus = parseAeProductSkusFromPayload(raw, aeProductId)
  const firstSku = aeSkus.find((s) => s.aeSkuId) ?? aeSkus[0]

  return {
    aeProductId,
    aeSkuId: firstSku?.aeSkuId || parseFirstSkuId(raw),
    aeShopId: parseShopId(raw),
    aePriceCents: firstSku?.aePriceCents ?? mapped.basePriceCents,
    aeShippingCents: 0,
    aeUrl,
    aeSkus,
  }
}
