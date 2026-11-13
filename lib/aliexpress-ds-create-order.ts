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
import { isAliExpressIllegalAccessTokenError } from "@/lib/aliexpress-token-errors"
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
      /**
       * true = a request WAS sent and its outcome is unknown (timeout, network error, unreadable response): AliExpress
       * may have created the order. The caller must NOT place the order again (nor try another channel) — it has to
       * leave the purchase "in doubt" for a human to reconcile. Absent / false = the order was definitely not created.
       */
      outcomeUncertain?: boolean
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

/**
 * What an answer to a place-order request tells us about the order — an ALLOW-LIST, never a deny-list.
 *
 *   "try_next_method" : the gateway rejected the CALL before AliExpress processed anything (unknown method, no permission,
 *                       bad signature / timestamp): nothing was created, the same order may go to the next method / host.
 *   "rate_limited"    : AliExpress throttled the call (explicit flag or wording): nothing was created, back off and retry.
 *   "definitive"      : an explicit, RECOGNISED business refusal (address, stock, price, SKU, shipping…) or a dead token:
 *                       nothing was created and re-sending the same order cannot help.
 *   "uncertain"       : EVERYTHING ELSE — a timeout, a network error, an unreadable or non-2xx answer, a gateway/ISP/ISV error
 *                       whose text is not on the list ("Remote service error", "remote connection timeout"…), a 2xx without
 *                       an order id and without a recognised refusal. A request that may have reached AliExpress produced
 *                       an answer we cannot read: the order MAY exist. It must NEVER be sent again, retried or released.
 */
export type PlaceOrderAnswerClass = "try_next_method" | "rate_limited" | "definitive" | "uncertain"

const sep = (text: string): string => text.toUpperCase().replace(/[_\-.:/]+/g, " ")

/**
 * Words of a TRANSPORT / SERVER fault, not of a business refusal ("remote connection timeout", "Remote service error",
 * "connect to remote address refused", "HTTP 503"…). When one is present the answer is uncertain, whatever else it says:
 * a word like ADDRESS or PRICE inside a fault message must not turn it into a "definitive refusal".
 */
const FAULT_WORDS =
  /\b(TIMEOUT|TIMED OUT|CONNECT(ION)?|UNREACHABLE|REFUSED|RESET|REMOTE|UPSTREAM|DOWNSTREAM|GATEWAY|PROXY|HOST|SERVER|IP|SERVICE ERROR|SERVICE UNAVAILABLE|INTERNAL|SYSTEM ERROR|UNKNOWN ERROR|BUSY|HTTP \d{3}|ISP|NON JSON)\b/

/** Business refusals AliExpress makes BEFORE creating an order. Matched on whole words of the upper-cased, de-punctuated text. */
const KNOWN_BUSINESS_REFUSALS: readonly RegExp[] = [
  /\bADDRESS\b/,
  /\bINVENTORY\b/,
  /\bSTOCK\b/,
  /\bPRICE\b/,
  /\b(INVALID|ILLEGAL|NOT EXIST|NOT FOUND) SKU\b/,
  /\bSKU (INVALID|ILLEGAL|NOT EXIST|NOT FOUND|NOT AVAILABLE)\b/,
  /\bPRODUCT (NOT EXIST|NOT FOUND|OFFLINE|OFF SHELF|UNAVAILABLE|IS OFFLINE)\b/,
  /\b(SHIPPING|LOGISTICS|DELIVERY) (NOT|UNAVAILABLE|UNSUPPORTED)\b/,
  /\bNOT SUPPORT(ED)? (SHIP|DELIVER)/,
  /\bA00\d*\b/,
]

/** Gateway rejections of the CALL itself (nothing processed). `isRetryableMethodError` + signature / timestamp. */
function isGatewayCallRejection(message: string): boolean {
  if (isRetryableMethodError(message)) return true
  const m = message.toLowerCase()
  return (
    m.includes("invalid signature") ||
    m.includes("invalid-signature") ||
    m.includes("signature is invalid") ||
    m.includes("sign check") ||
    m.includes("invalid timestamp") ||
    m.includes("invalid-timestamp") ||
    m.includes("timestamp is invalid")
  )
}

function isThrottled(message: string, rateLimited: boolean): boolean {
  if (rateLimited) return true
  return /too many requests|throttl|flow control|rate limit|request frequency/i.test(message)
}

export function classifyPlaceOrderAnswer(answer: { message: string; code?: string | number; rateLimited?: boolean }): PlaceOrderAnswerClass {
  const text = `${answer.code ?? ""} ${answer.message}`
  if (isGatewayCallRejection(text)) return "try_next_method"
  if (isThrottled(answer.message, answer.rateLimited === true)) return "rate_limited"
  const normalised = sep(text)
  if (FAULT_WORDS.test(normalised)) return "uncertain"
  if (isAliExpressIllegalAccessTokenError(answer.message)) return "definitive"
  if (KNOWN_BUSINESS_REFUSALS.some((re) => re.test(normalised))) return "definitive"
  return "uncertain"
}

/** A thrown error: only an `AliExpressApiError` carrying AliExpress's own words can be classified; anything else is uncertain. */
export function classifyPlaceOrderError(e: unknown): PlaceOrderAnswerClass {
  if (!(e instanceof AliExpressApiError)) return "uncertain"
  return classifyPlaceOrderAnswer({ message: e.message, code: e.code, rateLimited: e.rateLimited })
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
            strictHttpStatus: true,
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

          // A 2xx answer without an order id: only an explicit, recognised refusal means "nothing was created".
          const root = asRecord(payload) ?? {}
          const place =
            asRecord(root.aliexpress_trade_buy_placeorder_response) ??
            asRecord(root.aliexpress_ds_order_create_response) ??
            root
          const result = asRecord(place.result) ?? place
          const explicit = pickString(result, ["error_code", "error_msg", "msg", "message", "sub_msg"])
          const bizMsg = explicit || "aliexpress_ds_order_id_missing"
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
          const verdict = explicit ? classifyPlaceOrderAnswer({ message: explicit }) : "uncertain"
          if (verdict === "definitive") {
            return { ok: false, error: bizMsg, methodAttempts, debugPayload: lastPayload }
          }
          if (verdict === "uncertain") {
            // Reached AliExpress, no order id, no recognised refusal: the order may exist. Do not send it again.
            console.log("[aliexpress-ds-create]", { result: "outcome_uncertain", method: label, bizMsg, ...addrLog })
            return { ok: false, error: bizMsg, methodAttempts, debugPayload: lastPayload, outcomeUncertain: true }
          }
          // try_next_method / rate_limited: the call was rejected before anything was processed — go on.
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

          const verdict = classifyPlaceOrderError(e)

          // The request may have created the order and the answer is unreadable: sending the same order again on another
          // host / method would buy twice. Stop here and report the outcome as unknown.
          if (verdict === "uncertain") {
            console.log("[aliexpress-ds-create]", {
              result: "outcome_uncertain",
              method: label,
              message,
              ...addrLog,
            })
            return {
              ok: false,
              error: message,
              methodAttempts,
              debugPayload: lastPayload,
              outcomeUncertain: true,
            }
          }

          // A recognised business refusal / dead token: nothing was created and the same order cannot succeed elsewhere.
          if (verdict === "definitive") {
            return { ok: false, error: message, methodAttempts, debugPayload: lastPayload }
          }

          if (verdict === "rate_limited" && attempt < maxAttempts) {
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
            result: verdict === "try_next_method" ? "method_unavailable" : "rate_limited",
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
}): Promise<
  { ok: true; aeOrderId: string } | { ok: false; error: string; outcomeUncertain?: boolean }
> {
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
  return result.outcomeUncertain
    ? { ok: false, error: result.error, outcomeUncertain: true }
    : { ok: false, error: result.error }
}
