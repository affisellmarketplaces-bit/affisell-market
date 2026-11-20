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
       * true = a request WAS sent and its outcome is unknown (timeout, network error, unreadable or non-2xx response, a platform
       * fault, an answer that is not a recognised refusal): AliExpress may have created the order. The caller must NOT place
       * the order again (nor try another channel) — it has to leave the purchase "in doubt" for a human to reconcile.
       * Absent / false = nothing was sent, or the answer was a RECOGNISED refusal (see `classifyPlaceOrderAnswer`, which says
       * exactly what that recognition covers and what it does not).
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
 *   "try_next_method" : the call was rejected BEFORE AliExpress processed anything (unknown method, no permission, bad
 *                       signature / timestamp, HTTP 401/403/404/405, or the connection was never made: DNS failure, refused
 *                       connection): nothing was created, the same order may go to the next method / host.
 *   "rate_limited"    : AliExpress throttled the call (explicit flag, HTTP 429, throttle wording or code): nothing was
 *                       created, back off and retry.
 *   "definitive"      : an explicit, RECOGNISED business refusal (address, stock/inventory, price, SKU, shipping…) or a dead
 *                       token, found on any field of the answer and with no sign of a platform fault: nothing was created and
 *                       re-sending the same order cannot help.
 *   "uncertain"       : EVERYTHING ELSE — a timeout, a network error, an unreadable or non-2xx answer, an ISP (platform fault)
 *                       envelope whatever its text says, a gateway error whose text is not on the list, a 2xx without an order
 *                       id and without a recognised refusal. The order MAY exist: it is never sent again, retried or released.
 *
 * What this guarantees and what it does not: for ANY answer outside the two lists above the outcome is treated as unknown
 * (fails safe, a human looks). The "definitive" side is a recognition by words: a platform fault worded in a way that neither
 * the fault list (`FAULT_WORDS`) nor the ISP envelope reveals, and that happens to contain a business word, would be read as a
 * refusal. The lists are built from observed and documented answers; they are not a proof against every message AliExpress can
 * produce.
 */
export type PlaceOrderAnswerClass = "try_next_method" | "rate_limited" | "definitive" | "uncertain"

/** Upper-case, split camelCase ("ReadTimeoutException" → "READ TIMEOUT EXCEPTION") and turn punctuation into spaces. */
const normalise = (text: string): string =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toUpperCase()
    .replace(/[_\-.:/|]+/g, " ")

/**
 * Words of a TRANSPORT / SERVER / PLATFORM fault, not of a business refusal ("remote connection timeout", "Remote service
 * error", "ReadTimeoutException", "service degraded, retry later"). When one is present the answer is uncertain, whatever else
 * it says: a word like ADDRESS or PRICE inside a fault message must not turn it into a "definitive refusal".
 */
const FAULT_WORDS =
  /\b(TIMEOUT|TIME OUT|TIMED OUT|CONNECT(ION)?|UNREACHABLE|REFUSED|RESET|REMOTE|UPSTREAM|DOWNSTREAM|GATEWAY|PROXY|HOST|SERVER|IP|SERVICE ERROR|SERVICE UNAVAILABLE|UNAVAILABLE|INTERNAL|SYSTEM ERROR|UNKNOWN ERROR|BUSY|HTTP \d{3}|ISP|NON JSON|EXCEPTION|MAINTENANCE|OVERLOAD(ED)?|DEGRADED|RETRY LATER|RETRY|RETRIES|DOWN)\b/

/** Business refusals AliExpress makes BEFORE creating an order. Matched on whole words of the normalised text. */
const KNOWN_BUSINESS_REFUSALS: readonly RegExp[] = [
  /\bADDRESS\b/,
  /\bINVENTORY\b/,
  /\bSTOCK\b/,
  /\bPRICE\b/,
  /\b(INVALID|ILLEGAL|NOT EXIST|NOT FOUND) SKU\b/,
  /\bSKU (INVALID|ILLEGAL|NOT EXIST|NOT FOUND|NOT AVAILABLE)\b/,
  /\bPRODUCT (NOT EXIST|NOT FOUND|OFFLINE|OFF SHELF|IS OFFLINE)\b/,
  /\b(SHIPPING|LOGISTICS|DELIVERY) (NOT|UNSUPPORTED)\b/,
  /\bSHIPPING METHOD NOT AVAILABLE\b/,
  /\bNOT AVAILABLE FOR (THIS )?COUNTRY\b/,
  /\bCANNOT BE SHIPPED\b/,
  /\bNOT SUPPORT(ED)? (SHIP|DELIVER)/,
  /\bINVALID (MOBILE|PHONE|POSTAL|POSTCODE|ZIP)\b/,
  /\bA00\d*\b/,
]

/** Throttle wording / codes (TOP and IOP gateways). */
const THROTTLE_WORDS =
  /\b(TOO MANY REQUESTS|THROTTL\w*|FLOW CONTROL|RATE LIMIT\w*|REQUEST FREQUENCY|ACCESS FREQUENCY|API CALL LIMIT|LIMITED BY API|API ACCESS COUNT|THIS BAN WILL LAST)\b/

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

export type PlaceOrderAnswer = {
  message: string
  code?: string | number
  rateLimited?: boolean
  /** Gateway envelope type when the gateway sent one (see `AliExpressApiError.gatewayType`). */
  gatewayType?: "ISP" | "ISV"
  /** EVERY text field of the answer, joined (the first non-empty one is not enough). */
  detail?: string
}

export function classifyPlaceOrderAnswer(answer: PlaceOrderAnswer): PlaceOrderAnswerClass {
  const code = answer.code == null ? "" : String(answer.code)

  // Statuses surfaced by `strictHttpStatus`: a request that was throttled or rejected at the door was not processed.
  if (code === "HTTP_429") return "rate_limited"
  if (["HTTP_401", "HTTP_403", "HTTP_404", "HTTP_405"].includes(code)) return "try_next_method"

  // Classify on EVERYTHING the answer says, never on the first non-empty field.
  const text = [code, answer.message, answer.detail].filter(Boolean).join(" | ")
  const normalised = normalise(text)

  // A platform / remote-service fault: the call reached the platform and something behind it failed — outcome unknown.
  if (answer.gatewayType === "ISP") return "uncertain"
  if (answer.rateLimited === true || THROTTLE_WORDS.test(normalised)) return "rate_limited"
  if (FAULT_WORDS.test(normalised)) return "uncertain"
  if (isGatewayCallRejection(text)) return "try_next_method"
  if (isAliExpressIllegalAccessTokenError(text)) return "definitive"
  if (KNOWN_BUSINESS_REFUSALS.some((re) => re.test(normalised))) return "definitive"
  return "uncertain"
}

/** Errors proving that NOT ONE BYTE of the request left this process (nothing can have been created). */
const NEVER_SENT_CODES = new Set(["ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"])

function neverSent(e: unknown): boolean {
  const seen = new Set<unknown>()
  let cur: unknown = e
  for (let depth = 0; depth < 4 && cur && typeof cur === "object" && !seen.has(cur); depth++) {
    seen.add(cur)
    const code = (cur as { code?: unknown }).code
    if (typeof code === "string" && NEVER_SENT_CODES.has(code)) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

/** A thrown error: only an `AliExpressApiError` carrying AliExpress's own words can be classified; anything else is uncertain
 *  — except a connection that was provably never made (DNS failure, refused connection), where nothing was sent. */
export function classifyPlaceOrderError(e: unknown): PlaceOrderAnswerClass {
  if (e instanceof AliExpressApiError) {
    return classifyPlaceOrderAnswer({
      message: e.message,
      code: e.code,
      rateLimited: e.rateLimited,
      gatewayType: e.gatewayType,
      detail: e.detail,
    })
  }
  return neverSent(e) ? "try_next_method" : "uncertain"
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
          // Every text field of the answer, not just the first non-empty one: {error_code: "A001", error_msg: "remote service
          // timeout"} must be judged on both.
          const everyField = ["error_code", "error_msg", "msg", "message", "sub_msg", "sub_code", "code"]
            .map((k) => pickString(result, [k]))
            .filter(Boolean)
            .join(" | ")
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
          const verdict = everyField ? classifyPlaceOrderAnswer({ message: explicit || everyField, detail: everyField }) : "uncertain"
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
