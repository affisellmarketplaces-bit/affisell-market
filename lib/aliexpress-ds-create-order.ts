import "server-only"

import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import {
  AliExpressAddressError,
  mapAffisellAddressToAliExpress,
  summarizeAddressForLog,
  type AffisellShippingAddressInput,
  type AliExpressLogisticsAddress,
} from "@/lib/aliexpress-mapping"
import { getValidAccessToken } from "@/lib/aliexpress-oauth"
import {
  AliExpressApiError,
  AliExpressClient,
} from "@/lib/aliexpress-open-api"
import {
  ALIEXPRESS_DS_SYNC_HOSTS,
  callAliExpressSyncMethod,
} from "@/lib/aliexpress-ds-sync"
import { readAliExpressConfig } from "@/lib/aliexpress-config"

export type CreateAliExpressDsOrderInput = {
  supplierProductId: string
  skuId: string
  quantity: number
  shippingAddress: AffisellShippingAddressInput
  customerNote?: string | null
  /** Optional AE logistics service name (from freight.calculate). */
  logisticsServiceName?: string | null
}

export type CreateAliExpressDsOrderResult =
  | {
      ok: true
      aliexpressOrderId: string
      trackingPreview: string | null
      method: string
      dryRun?: boolean
    }
  | {
      ok: false
      error: string
      methodAttempts: string[]
      debugPayload?: Record<string, unknown>
    }

/** Official DS place-order methods (ae_sdk / Open Platform). */
const DS_ORDER_METHODS = [
  "aliexpress.ds.order.create",
  "aliexpress.trade.buy.placeorder",
] as const

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function extractOrderList(node: Record<string, unknown>): string[] {
  const raw = node.order_list ?? node.orderList
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter(Boolean)
  }
  const nested = asRecord(raw)
  if (nested) {
    const numbers = nested.number ?? nested.numbers
    if (Array.isArray(numbers)) {
      return numbers.map((x) => String(x)).filter(Boolean)
    }
    if (typeof numbers === "string" || typeof numbers === "number") {
      return [String(numbers)]
    }
  }
  if (typeof raw === "string" || typeof raw === "number") {
    return [String(raw)]
  }
  return []
}

function extractOrderId(payload: unknown): { orderId: string; trackingPreview: string | null } {
  const root = asRecord(payload) ?? {}
  const candidates = [
    asRecord(root.aliexpress_ds_order_create_response),
    asRecord(root.aliexpress_trade_buy_placeorder_response),
    asRecord(root.result),
    root,
  ].filter(Boolean) as Record<string, unknown>[]

  for (const node of candidates) {
    const result = asRecord(node.result) ?? node
    const fromList = extractOrderList(result)
    if (fromList[0]) {
      return {
        orderId: fromList[0]!,
        trackingPreview:
          pickString(result, ["tracking_number", "trackingNumber", "logistics_no"]) || null,
      }
    }
    const orderId = pickString(result, [
      "order_id",
      "orderId",
      "order_id_str",
      "ae_order_id",
      "trade_order_id",
    ])
    if (orderId) {
      return {
        orderId,
        trackingPreview:
          pickString(result, ["tracking_number", "trackingNumber", "logistics_no"]) || null,
      }
    }
  }
  return { orderId: "", trackingPreview: null }
}

function isRetryableMethodError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("api path is invalid") ||
    m.includes("isv.api-not-exist") ||
    m.includes("api not exist") ||
    m.includes("invalid-method") ||
    m.includes("method not support") ||
    m.includes("permission deny") ||
    m.includes("not authorized")
  )
}

function isRateLimitError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("rate") || m.includes("limit") || m.includes("too many") || m.includes("throttle")
}

/** AE place-order logistics_address (official DTO fields). */
function toPlaceOrderAddress(logistics: AliExpressLogisticsAddress) {
  return {
    address: logistics.address || logistics.full_address,
    address2: "",
    city: logistics.city,
    contact_person: logistics.contact_person,
    full_name: logistics.contact_person,
    country: logistics.country,
    province: logistics.province,
    zip: logistics.zip,
    mobile_no: logistics.mobile_no,
    // Official examples use "+33" style
    phone_country: logistics.phone_country.startsWith("+")
      ? logistics.phone_country
      : `+${logistics.phone_country}`,
    locale: "fr_FR",
  }
}

function buildPlaceOrderBizParams(args: {
  productId: string
  skuId: string
  quantity: number
  logistics: AliExpressLogisticsAddress
  buyerMessage: string
  logisticsServiceName?: string | null
}): Record<string, string> {
  const productIdNum = Number(args.productId)
  const productItem: Record<string, unknown> = {
    product_id: Number.isFinite(productIdNum) ? productIdNum : args.productId,
    product_count: Math.max(1, args.quantity),
  }
  // sku_attr = SKU property string (e.g. "14:200003699#Black"); sku_id = numeric when known
  if (args.skuId.includes(":") || args.skuId.includes("#")) {
    productItem.sku_attr = args.skuId
  } else {
    productItem.sku_attr = args.skuId
    productItem.sku_id = args.skuId
  }
  if (args.buyerMessage) productItem.order_memo = args.buyerMessage.slice(0, 500)
  if (args.logisticsServiceName?.trim()) {
    productItem.logistics_service_name = args.logisticsServiceName.trim()
  }

  const placeOrderDto = {
    logistics_address: toPlaceOrderAddress(args.logistics),
    product_items: [productItem],
  }

  return {
    param_place_order_request4_open_api_d_t_o: JSON.stringify(placeOrderDto),
  }
}

/**
 * Place AliExpress DS order with official place-order DTO + method/host fallbacks.
 */
export async function createAliExpressDsOrder(
  input: CreateAliExpressDsOrderInput
): Promise<CreateAliExpressDsOrderResult> {
  const productId = input.supplierProductId.trim()
  const skuId = input.skuId.trim()
  const qty = Math.max(1, Math.floor(input.quantity) || 1)

  if (!productId || !skuId) {
    return { ok: false, error: "missing_product_or_sku", methodAttempts: [] }
  }

  let logistics: AliExpressLogisticsAddress
  try {
    logistics = mapAffisellAddressToAliExpress(input.shippingAddress)
  } catch (e) {
    const message = e instanceof AliExpressAddressError ? e.message : "invalid_address"
    return { ok: false, error: message, methodAttempts: [] }
  }

  const addrLog = summarizeAddressForLog(logistics)
  console.log("[aliexpress-ds-create]", {
    result: "start",
    productId,
    skuId: skuId.length > 4 ? `…${skuId.slice(-4)}` : skuId,
    quantity: qty,
    ...addrLog,
  })

  if (isAeDryRun()) {
    const dryId = `DRY_RUN_DS_${Date.now()}`
    console.log("[aliexpress-ds-create]", { result: "dry_run", aliexpressOrderId: dryId, ...addrLog })
    return {
      ok: true,
      aliexpressOrderId: dryId,
      trackingPreview: null,
      method: "dry_run",
      dryRun: true,
    }
  }

  if (!AliExpressClient.isConfigured()) {
    return { ok: false, error: "aliexpress_api_not_configured", methodAttempts: [] }
  }

  const config = readAliExpressConfig()
  let accessToken: string
  try {
    accessToken = await getValidAccessToken()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "token_error",
      methodAttempts: [],
    }
  }

  const buyerMessage = (input.customerNote ?? "").trim()
  const biz = buildPlaceOrderBizParams({
    productId,
    skuId,
    quantity: qty,
    logistics,
    buyerMessage,
    logisticsServiceName: input.logisticsServiceName,
  })

  const methodAttempts: string[] = []
  let lastError = "aliexpress_ds_order_failed"
  let lastPayload: Record<string, unknown> | undefined

  const maxAttempts = 2
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const host of ALIEXPRESS_DS_SYNC_HOSTS) {
      const hostLabel = host.includes("api-sg") ? "sg" : "global"
      for (const method of DS_ORDER_METHODS) {
        const label = `${method}@${hostLabel}#${attempt}`
        methodAttempts.push(label)
        try {
          const payload = await callAliExpressSyncMethod({
            method,
            bizParams: biz,
            appKey: config.appKey,
            appSecret: config.appSecret,
            accessToken,
            host,
          })
          const { orderId, trackingPreview } = extractOrderId(payload)
          if (orderId) {
            console.log("[aliexpress-ds-create]", {
              result: "ok",
              method: label,
              aliexpressOrderId: `…${orderId.slice(-6)}`,
              ...addrLog,
            })
            return {
              ok: true,
              aliexpressOrderId: orderId,
              trackingPreview,
              method: label,
            }
          }

          // Business failure without order id (address / stock / payment)
          const root = asRecord(payload) ?? {}
          const place =
            asRecord(root.aliexpress_trade_buy_placeorder_response) ??
            asRecord(root.aliexpress_ds_order_create_response) ??
            root
          const result = asRecord(place.result) ?? place
          const bizMsg =
            pickString(result, ["error_code", "error_msg", "msg", "message", "sub_msg"]) ||
            "aliexpress_ds_order_id_missing"
          lastError = bizMsg
          lastPayload = {
            method: label,
            productId,
            quantity: qty,
            address: addrLog,
            responseKeys: Object.keys(root),
            bizMsg,
          }
          console.log("[aliexpress-ds-create]", {
            result: "no_order_id",
            method: label,
            bizMsg,
            ...addrLog,
          })
          // Don't retry other hosts for clear business errors
          if (
            bizMsg.includes("ADDRESS") ||
            bizMsg.includes("INVENTORY") ||
            bizMsg.includes("PRICE") ||
            bizMsg.startsWith("A00")
          ) {
            return {
              ok: false,
              error: bizMsg,
              methodAttempts,
              debugPayload: lastPayload,
            }
          }
        } catch (e) {
          const message =
            e instanceof AliExpressApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "aliexpress_ds_order_failed"
          lastError = message
          lastPayload = {
            method: label,
            productId,
            quantity: qty,
            address: addrLog,
            error: message,
          }

          if (isRateLimitError(message) && attempt < maxAttempts) {
            const delayMs = 800 * 2 ** (attempt - 1)
            console.log("[aliexpress-ds-create]", {
              result: "rate_limit_backoff",
              attempt,
              delayMs,
              method: label,
            })
            await new Promise((r) => setTimeout(r, delayMs))
            break
          }

          console.log("[aliexpress-ds-create]", {
            result: isRetryableMethodError(message) ? "method_unavailable" : "method_error",
            method: label,
            message,
            ...addrLog,
          })
        }
      }
    }
  }

  console.log("[aliexpress-ds-create]", {
    result: "failed",
    error: lastError,
    methods: methodAttempts,
    debugPayload: lastPayload,
  })

  return {
    ok: false,
    error: lastError,
    methodAttempts,
    debugPayload: lastPayload,
  }
}

/** @deprecated Prefer createAliExpressDsOrder — kept for auto-buy callers. */
export async function placeAliExpressDsOrder(input: {
  aeProductId: string
  aeSkuId: string | null
  quantity: number
  shippingAddress: {
    name?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
    phone?: string
  }
}): Promise<{ ok: true; aeOrderId: string } | { ok: false; error: string }> {
  const result = await createAliExpressDsOrder({
    supplierProductId: input.aeProductId,
    skuId: input.aeSkuId?.trim() || "0",
    quantity: input.quantity,
    shippingAddress: {
      name: input.shippingAddress.name,
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2,
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      postal_code: input.shippingAddress.postal_code,
      country: input.shippingAddress.country,
      phone: input.shippingAddress.phone,
    },
  })
  if (result.ok) return { ok: true, aeOrderId: result.aliexpressOrderId }
  return { ok: false, error: result.error }
}
