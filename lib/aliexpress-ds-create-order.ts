import "server-only"

import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import {
  AliExpressAddressError,
  mapAffisellAddressToAliExpress,
  summarizeAddressForLog,
  type AffisellShippingAddressInput,
  type AliExpressLogisticsAddress,
} from "@/lib/aliexpress-mapping"
import { AliExpressApiError, AliExpressClient, createAliExpressClient } from "@/lib/aliexpress-open-api"

export type CreateAliExpressDsOrderInput = {
  supplierProductId: string
  skuId: string
  quantity: number
  shippingAddress: AffisellShippingAddressInput
  customerNote?: string | null
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

const DS_ORDER_METHODS = [
  "aliexpress.ds.order.create",
  "aliexpress.ds.trade.order.create",
  "aliexpress.trade.ds.order.create",
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

function extractOrderId(payload: unknown): { orderId: string; trackingPreview: string | null } {
  const root = asRecord(payload) ?? {}
  const candidates = [
    asRecord(root.aliexpress_ds_order_create_response),
    asRecord(root.aliexpress_ds_trade_order_create_response),
    asRecord(root.aliexpress_trade_ds_order_create_response),
    asRecord(root.result),
    root,
  ].filter(Boolean) as Record<string, unknown>[]

  for (const node of candidates) {
    const result = asRecord(node.result) ?? node
    const orderId = pickString(result, [
      "order_id",
      "orderId",
      "order_id_str",
      "ae_order_id",
      "trade_order_id",
    ])
    if (orderId) {
      const trackingPreview =
        pickString(result, ["tracking_number", "trackingNumber", "logistics_no", "lp_number"]) ||
        null
      return { orderId, trackingPreview }
    }
  }
  return { orderId: "", trackingPreview: null }
}

function isUnavailableMethodError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("isv.api-not-exist") ||
    m.includes("api not exist") ||
    m.includes("invalid-method") ||
    m.includes("method not support") ||
    m.includes("permission") ||
    m.includes("not authorized") ||
    m.includes("isp.remote-service-error")
  )
}

function isRateLimitError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("rate") || m.includes("limit") || m.includes("too many") || m.includes("throttle")
}

function buildBizParams(args: {
  productId: string
  skuId: string
  quantity: number
  logistics: AliExpressLogisticsAddress
  buyerMessage: string
}): Record<string, string> {
  const logisticsJson = JSON.stringify(args.logistics)
  return {
    product_id: args.productId,
    product_count: String(Math.max(1, args.quantity)),
    sku_id: args.skuId,
    sku_attr: args.skuId,
    logistics_address: logisticsJson,
    buyer_message: args.buyerMessage.slice(0, 500),
  }
}

/**
 * Place AliExpress DS order with method fallbacks (test accounts often miss one API).
 * Retries up to 3× on rate-limit with exponential backoff.
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

  const buyerMessage = (input.customerNote ?? "").trim()
  const biz = buildBizParams({
    productId,
    skuId,
    quantity: qty,
    logistics,
    buyerMessage,
  })

  const methodAttempts: string[] = []
  let lastError = "aliexpress_ds_order_failed"
  let lastPayload: Record<string, unknown> | undefined

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client: AliExpressClient
    try {
      client = await createAliExpressClient()
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "token_error",
        methodAttempts,
      }
    }

    for (const method of DS_ORDER_METHODS) {
      methodAttempts.push(`${method}#${attempt}`)
      try {
        const payload = await client.request(method, biz)
        const { orderId, trackingPreview } = extractOrderId(payload)
        if (orderId) {
          console.log("[aliexpress-ds-create]", {
            result: "ok",
            method,
            attempt,
            aliexpressOrderId: `…${orderId.slice(-6)}`,
            ...addrLog,
          })
          return {
            ok: true,
            aliexpressOrderId: orderId,
            trackingPreview,
            method,
          }
        }
        lastError = "aliexpress_ds_order_id_missing"
        lastPayload = {
          method,
          productId,
          quantity: qty,
          address: addrLog,
          responseKeys: Object.keys(asRecord(payload) ?? {}),
        }
        console.log("[aliexpress-ds-create]", {
          result: "no_order_id",
          method,
          attempt,
          ...addrLog,
        })
      } catch (e) {
        const message =
          e instanceof AliExpressApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "aliexpress_ds_order_failed"
        lastError = message
        lastPayload = { method, productId, quantity: qty, address: addrLog, error: message }

        if (isRateLimitError(message) && attempt < maxAttempts) {
          const delayMs = 500 * 2 ** (attempt - 1)
          console.log("[aliexpress-ds-create]", {
            result: "rate_limit_backoff",
            attempt,
            delayMs,
            method,
          })
          await new Promise((r) => setTimeout(r, delayMs))
          break // retry outer attempt with same methods
        }

        if (isUnavailableMethodError(message)) {
          console.log("[aliexpress-ds-create]", {
            result: "method_unavailable",
            method,
            message,
          })
          continue
        }

        console.log("[aliexpress-ds-create]", {
          result: "method_error",
          method,
          message,
          ...addrLog,
        })
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
