import {
  AliExpressApiError,
  encodeAliExpressQuery,
  getAliExpressTimestamp,
  getAliExpressTimestampMs,
  signAliExpressParams,
  signAliExpressTopHmacSha256,
  unwrapAliExpressMethodResponse,
} from "@/lib/aliexpress-open-api"
import { isAliExpressIllegalAccessTokenError } from "@/lib/aliexpress-token-errors"

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

const GATEWAY_TEXT_FIELDS = ["message", "msg", "sub_msg", "error", "error_msg", "rsp_msg", "rspMsg", "code", "sub_code", "error_code"] as const

/** Every non-empty text field of a gateway answer, joined: classification must see all of them, not just the first. */
function allGatewayText(node: Record<string, unknown>): string {
  return GATEWAY_TEXT_FIELDS.map((k) => pickString(node, [k]))
    .filter(Boolean)
    .join(" | ")
}

function parseGatewayErrorDetail(
  json: unknown
): { message: string; code?: string; gatewayType?: "ISP" | "ISV"; detail: string } | null {
  const root = asRecord(json)
  if (!root) return null
  if (root.type === "ISV" || root.type === "ISP") {
    return {
      message: pickString(root, ["message", "msg", "sub_msg", "error"]) || "AliExpress ISV error",
      code: pickString(root, ["code", "sub_code", "error_code"]) || undefined,
      gatewayType: root.type,
      detail: allGatewayText(root),
    }
  }
  const err = asRecord(root.error_response)
  if (err) {
    const code = pickString(err, ["sub_code", "code", "error_code"]) || undefined
    // A TOP error_response carries no `type`, but its sub_code says whose fault it is ("isp.…" / "isv.…").
    const prefix = code?.toLowerCase().match(/^(isp|isv)[.\-_]/)?.[1]
    return {
      message: pickString(err, ["sub_msg", "msg", "message", "error"]) || "AliExpress API error",
      code,
      gatewayType: prefix === "isp" ? "ISP" : prefix === "isv" ? "ISV" : undefined,
      detail: allGatewayText(err),
    }
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
    (m.includes("illegalaccess") && !isAliExpressIllegalAccessTokenError(message)) ||
    m.includes("sign") ||
    m.includes("timestamp")
  )
}

type DsSyncStrategy = {
  label: string
  signMethod: "sha256" | "md5"
  timestamp: () => string
  transport: "query-empty" | "post-form"
  simplify: boolean
}

const DS_PRODUCT_STRATEGIES: DsSyncStrategy[] = [
  {
    label: "sha256-query",
    signMethod: "sha256",
    timestamp: getAliExpressTimestampMs,
    transport: "query-empty",
    simplify: true,
  },
  {
    label: "sha256-form",
    signMethod: "sha256",
    timestamp: getAliExpressTimestampMs,
    transport: "post-form",
    simplify: true,
  },
  {
    label: "sha256-full",
    signMethod: "sha256",
    timestamp: getAliExpressTimestampMs,
    transport: "query-empty",
    simplify: false,
  },
  {
    label: "md5-form",
    signMethod: "md5",
    timestamp: getAliExpressTimestamp,
    transport: "post-form",
    simplify: false,
  },
]

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
  strategy?: DsSyncStrategy
  /**
   * Write calls (place order): an HTTP status outside 2xx whose body is not a recognised error envelope is NOT a normal
   * answer — it is thrown as `AliExpressApiError` with code `HTTP_<status>` instead of being read as a payload. Off by default:
   * read-only callers keep their historical behaviour.
   */
  strictHttpStatus?: boolean
}): Promise<unknown> {
  const strategy = args.strategy ?? DS_PRODUCT_STRATEGIES[0]!
  const params: Record<string, string> = {
    method: args.method,
    app_key: args.appKey,
    session: args.accessToken,
    access_token: args.accessToken,
    sign_method: strategy.signMethod,
    timestamp: strategy.timestamp(),
    format: "json",
    v: "2.0",
    ...args.bizParams,
  }
  if (strategy.simplify) params.simplify = "true"
  params.sign =
    strategy.signMethod === "md5"
      ? signAliExpressParams(params, args.appSecret)
      : signAliExpressTopHmacSha256(params, args.appSecret)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    if (strategy.transport === "query-empty") {
      res = await fetch(`${args.host}?${encodeAliExpressQuery(params)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: "",
        signal: controller.signal,
        cache: "no-store",
      })
    } else {
      res = await fetch(args.host, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: encodeAliExpressQuery(params),
        signal: controller.signal,
        cache: "no-store",
      })
    }
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

  const gatewayError = parseGatewayErrorDetail(json)
  if (gatewayError) {
    throw new AliExpressApiError(gatewayError.message, {
      code: gatewayError.code,
      gatewayType: gatewayError.gatewayType,
      detail: gatewayError.detail,
    })
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
      throw new AliExpressApiError(msg, {
        code: rspCode,
        rateLimited: Number(rspCode) === 40,
        detail: allGatewayText(methodNode),
      })
    }
  }

  if (args.strictHttpStatus && (res.status < 200 || res.status >= 300)) {
    throw new AliExpressApiError(`AliExpress HTTP ${res.status}`, { code: `HTTP_${res.status}` })
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

async function getAliExpressDsProductOnce(args: {
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
    for (const strategy of DS_PRODUCT_STRATEGIES) {
      const methodLabel = `aliexpress.ds.product.get@${hostLabel}/${strategy.label}`
      try {
        const payload = await callAliExpressSyncMethod({
          method: "aliexpress.ds.product.get",
          bizParams,
          appKey: args.appKey,
          appSecret: args.appSecret,
          accessToken: args.accessToken,
          host,
          strategy,
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
        if (isAliExpressIllegalAccessTokenError(message)) {
          throw e instanceof AliExpressApiError ? e : new AliExpressApiError(message)
        }
        if (!isRetryableDsError(message)) {
          throw e instanceof AliExpressApiError ? e : new AliExpressApiError(message)
        }
      }
    }
  }

  throw new AliExpressApiError(lastError)
}

/** Fetch product via official DS API (multi-host + multi-sign strategies). */
export async function getAliExpressDsProduct(args: {
  productId: string
  appKey: string
  appSecret: string
  accessToken: string
}): Promise<{ payload: unknown; methodLabel: string }> {
  try {
    return await getAliExpressDsProductOnce(args)
  } catch (e) {
    const message =
      e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : String(e)
    if (!isAliExpressIllegalAccessTokenError(message)) throw e

    const { getValidAccessToken, isTransientAliExpressFailure } = await import("@/lib/aliexpress-oauth")
    let freshToken: string
    try {
      freshToken = await getValidAccessToken({ forceRefresh: true })
    } catch (refreshErr) {
      const refreshMsg =
        refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
      throw new AliExpressApiError(
        // "refresh token invalide" lets the UI tell a dead session (reconnect) from a passing outage (retry).
        `${message} — ${isTransientAliExpressFailure(refreshErr) ? "refresh échoué" : "refresh token invalide"} : ${refreshMsg}`
      )
    }

    if (freshToken === args.accessToken) {
      throw new AliExpressApiError(
        `${message} — reconnectez OAuth via /api/aliexpress/oauth/start`
      )
    }

    console.log("[aliexpress-ds-sync]", {
      productId: args.productId,
      result: "token_refresh_retry",
      tokenTail: freshToken.slice(-4),
    })
    return getAliExpressDsProductOnce({ ...args, accessToken: freshToken })
  }
}
