import {
  AliExpressApiError,
  encodeAliExpressQuery,
  getAliExpressTimestampMs,
  signAliExpressTopHmacSha256,
  unwrapAliExpressMethodResponse,
} from "@/lib/aliexpress-open-api"

/** DS Open Platform sync hosts — SG first (App 534690 / ae_sdk). */
export const ALIEXPRESS_DS_SYNC_HOSTS = [
  "https://api-sg.aliexpress.com/sync",
  "https://api.aliexpress.com/sync",
] as const

const REQUEST_TIMEOUT_MS = 20_000

const DEFAULT_DS_LOCALE = {
  target_currency: "EUR",
  ship_to_country: "FR",
  target_language: "FR",
} as const

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return ""
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function parseGatewayError(json: unknown): string | null {
  const root = asRecord(json)
  if (!root) return null
  if (root.type === "ISV" || root.type === "ISP") {
    return pickString(root, ["message", "msg", "sub_msg", "error"]) || "AliExpress ISV error"
  }
  const err = asRecord(root.error_response)
  if (err) {
    return pickString(err, ["sub_msg", "msg", "message", "error"]) || "AliExpress API error"
  }
  return null
}

function isRetryableDsError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("api path is invalid") ||
    m.includes("isv.api-not-exist") ||
    m.includes("api not exist") ||
    m.includes("invalid-method") ||
    m.includes("method not support") ||
    m.includes("illegalaccess") ||
    m.includes("sign") ||
    m.includes("timestamp")
  )
}

/**
 * TOP/OP sync call (ae_sdk): sha256 HMAC, epoch-ms timestamp, query on URL, POST body empty.
 */
export async function callAliExpressSyncMethod(args: {
  method: string
  bizParams: Record<string, string>
  appKey: string
  appSecret: string
  accessToken: string
  host: string
}): Promise<unknown> {
  const params: Record<string, string> = {
    method: args.method,
    app_key: args.appKey,
    session: args.accessToken,
    access_token: args.accessToken,
    sign_method: "sha256",
    timestamp: getAliExpressTimestampMs(),
    format: "json",
    v: "2.0",
    simplify: "true",
    ...args.bizParams,
  }
  params.sign = signAliExpressTopHmacSha256(params, args.appSecret)

  const url = `${args.host}?${encodeAliExpressQuery(params)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: "",
      signal: controller.signal,
      cache: "no-store",
    })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AliExpressApiError("AliExpress API request timed out")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new AliExpressApiError(`AliExpress non-JSON (HTTP ${res.status})`)
  }

  const gatewayError = parseGatewayError(json)
  if (gatewayError) {
    throw new AliExpressApiError(gatewayError)
  }

  const methodNode = unwrapAliExpressMethodResponse(json, args.method)
  if (methodNode) {
    const rawRspCode = methodNode.rsp_code ?? methodNode.rspCode
    const rspCode: string | number | undefined =
      typeof rawRspCode === "string" || typeof rawRspCode === "number" ? rawRspCode : undefined
    if (rspCode != null && String(rspCode) !== "200" && Number(rspCode) !== 200) {
      const msg =
        (typeof methodNode.rsp_msg === "string" && methodNode.rsp_msg) ||
        (typeof methodNode.rspMsg === "string" && methodNode.rspMsg) ||
        "AliExpress business error"
      throw new AliExpressApiError(msg, { code: rspCode, rateLimited: Number(rspCode) === 40 })
    }
  }

  return json
}

function dsProductHasPayload(payload: unknown): boolean {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}
  const base =
    asRecord(result.ae_item_base_info_dto) ??
    asRecord(result.ae_item_base_info) ??
    asRecord(result.base_info_dto) ??
    result
  const subject = pickString(base, ["subject", "product_title", "title", "product_name"])
  return subject.length >= 2
}

/** Fetch product via official DS API (multi-host + sha256 — required for App 534690). */
export async function getAliExpressDsProduct(args: {
  productId: string
  appKey: string
  appSecret: string
  accessToken: string
}): Promise<{ payload: unknown; methodLabel: string }> {
  const productId = args.productId.trim()
  if (!productId) throw new AliExpressApiError("product_id is required")

  const bizParams: Record<string, string> = {
    product_id: productId,
    ...DEFAULT_DS_LOCALE,
  }

  let lastError = "aliexpress_ds_product_get_failed"
  for (const host of ALIEXPRESS_DS_SYNC_HOSTS) {
    const hostLabel = host.includes("api-sg") ? "sg" : "global"
    const methodLabel = `aliexpress.ds.product.get@${hostLabel}`
    try {
      const payload = await callAliExpressSyncMethod({
        method: "aliexpress.ds.product.get",
        bizParams,
        appKey: args.appKey,
        appSecret: args.appSecret,
        accessToken: args.accessToken,
        host,
      })
      if (!dsProductHasPayload(payload)) {
        lastError = "AliExpress DS product response empty"
        console.log("[aliexpress-ds-sync]", { methodLabel, result: "empty_payload" })
        continue
      }
      console.log("[aliexpress-ds-sync]", { methodLabel, productId, result: "ok" })
      return { payload, methodLabel }
    } catch (e) {
      const message =
        e instanceof AliExpressApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e)
      lastError = message
      console.log("[aliexpress-ds-sync]", {
        methodLabel,
        productId,
        result: "fail",
        error: message.slice(0, 160),
        retry: isRetryableDsError(message),
      })
      if (!isRetryableDsError(message)) {
        throw e instanceof AliExpressApiError ? e : new AliExpressApiError(message)
      }
    }
  }

  throw new AliExpressApiError(lastError)
}
