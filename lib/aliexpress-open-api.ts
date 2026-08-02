import crypto from "crypto"

import { getAliExpressConfigStatus, readAliExpressConfig } from "@/lib/aliexpress-config"
import { resolveAliExpressAccessToken } from "@/lib/aliexpress-oauth"

const REQUEST_TIMEOUT_MS = 10_000

const DEFAULT_BIZ_LOCALE = {
  target_currency: "EUR",
  ship_to_country: "FR",
  target_language: "FR",
} as const

export class AliExpressApiError extends Error {
  readonly code?: string | number
  readonly rateLimited: boolean

  constructor(message: string, opts?: { code?: string | number; rateLimited?: boolean }) {
    super(message)
    this.name = "AliExpressApiError"
    this.code = opts?.code
    this.rateLimited = opts?.rateLimited ?? false
  }
}

function resolveBaseUrl(sandbox?: boolean): string {
  if (sandbox === true) return "https://api-sg.aliexpress.com/sync"
  if (sandbox === false) return "https://api.aliexpress.com/sync"
  const env = process.env.ALIEXPRESS_ENV?.trim().toLowerCase()
  if (env === "sandbox") return "https://api-sg.aliexpress.com/sync"
  return "https://api.aliexpress.com/sync"
}

export type AliExpressClientCredentials = {
  appKey: string
  appSecret: string
  accessToken: string
  sandbox?: boolean
}

/**
 * AliExpress Open Platform timestamp: `yyyy-MM-dd HH:mm:ss` in Asia/Shanghai (UTC+8).
 * Server local TZ (e.g. Vercel UTC) must not be used — AE rejects IllegalTimestamp.
 */
export function getAliExpressTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const raw = parts.find((p) => p.type === type)?.value ?? "00"
    return raw.padStart(2, "0")
  }

  let hour = pick("hour")
  // Some engines emit "24" for midnight with hour12:false
  if (hour === "24") hour = "00"

  return `${pick("year")}-${pick("month")}-${pick("day")} ${hour}:${pick("minute")}:${pick("second")}`
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Sorted `key+value` concat (excludes `sign`). */
export function aliExpressSignPayload(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
  let payload = ""
  for (const key of sortedKeys) {
    payload += key + params[key]!
  }
  return payload
}

/** MD5 sign per Taobao/AliExpress Open Platform: secret + sorted(key+value) + secret, uppercase hex. */
export function signAliExpressParams(
  params: Record<string, string>,
  appSecret: string
): string {
  const base = appSecret + aliExpressSignPayload(params) + appSecret
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase()
}

/**
 * HMAC-SHA256 of the same TOP wrap string (secret + kv + secret), uppercase hex.
 * Used when sign_method=sha256 on REST system APIs.
 */
export function signAliExpressParamsHmacSha256(
  params: Record<string, string>,
  appSecret: string
): string {
  const base = appSecret + aliExpressSignPayload(params) + appSecret
  return crypto.createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase()
}

function parseTopLevelError(payload: Record<string, unknown>): never {
  const err = asRecord(payload.error_response)
  const rawCode = err?.code ?? err?.error_code
  const code: string | number | undefined =
    typeof rawCode === "string" || typeof rawCode === "number" ? rawCode : undefined
  const msg =
    (typeof err?.msg === "string" && err.msg) ||
    (typeof err?.sub_msg === "string" && err.sub_msg) ||
    (typeof err?.message === "string" && err.message) ||
    "AliExpress API error"
  const codeNum = typeof code === "number" ? code : Number(code)
  const rateLimited = codeNum === 40 || String(code) === "40"
  throw new AliExpressApiError(msg, { code, rateLimited })
}

export function unwrapAliExpressMethodResponse(
  payload: unknown,
  method: string
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as Record<string, unknown>
  if (root.error_response) parseTopLevelError(root)

  const snake = method.replace(/\./g, "_")
  const camel = snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  const keys = [
    `${snake}_response`,
    `${camel}Response`,
    "response",
  ]
  for (const k of keys) {
    const node = asRecord(root[k])
    if (node) return node
  }
  return asRecord(root)
}

export class AliExpressClient {
  private readonly appKey: string
  private readonly appSecret: string
  private readonly accessToken: string
  private readonly baseUrl: string

  constructor(credentials?: AliExpressClientCredentials) {
    if (credentials) {
      this.appKey = credentials.appKey
      this.appSecret = credentials.appSecret
      this.accessToken = credentials.accessToken
      this.baseUrl = resolveBaseUrl(credentials.sandbox)
      return
    }
    const config = readAliExpressConfig()
    this.appKey = config.appKey
    this.appSecret = config.appSecret
    this.accessToken = config.accessToken
    this.baseUrl = resolveBaseUrl(config.sandbox)
  }

  /** Sync check: app key + secret + (access or refresh token) present in env. */
  static isConfigured(): boolean {
    return getAliExpressConfigStatus().configured
  }

  isConfigured(): boolean {
    return Boolean(this.appKey && this.appSecret && this.accessToken)
  }

  assertConfigured(): void {
    if (!this.appKey || !this.appSecret) {
      throw new AliExpressApiError("AliExpress API credentials are not configured")
    }
    if (!this.accessToken) {
      throw new AliExpressApiError("AliExpress access token is not configured")
    }
  }

  sign(params: Record<string, string>): string {
    return signAliExpressParams(params, this.appSecret)
  }

  async request(method: string, bizParams: Record<string, string> = {}): Promise<unknown> {
    this.assertConfigured()

    const systemParams: Record<string, string> = {
      method,
      app_key: this.appKey,
      sign_method: "md5",
      timestamp: getAliExpressTimestamp(),
      format: "json",
      v: "2.0",
      session: this.accessToken,
    }

    const biz: Record<string, string> = {
      ...DEFAULT_BIZ_LOCALE,
      ...bizParams,
    }

    const allParams: Record<string, string> = { ...systemParams, ...biz }
    allParams.sign = this.sign(allParams)

    const body = new URLSearchParams(allParams)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: body.toString(),
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new AliExpressApiError("AliExpress API request timed out")
      }
      throw e
    } finally {
      clearTimeout(timeout)
    }

    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new AliExpressApiError(`AliExpress API returned non-JSON (HTTP ${res.status})`)
    }

    if (!res.ok) {
      const root = asRecord(json)
      if (root) parseTopLevelError(root)
      throw new AliExpressApiError(`AliExpress API HTTP ${res.status}`)
    }

    const root = asRecord(json)
    if (!root) {
      throw new AliExpressApiError("AliExpress API returned an empty response")
    }
    if (root.error_response) parseTopLevelError(root)

    const methodNode = unwrapAliExpressMethodResponse(json, method)
    if (methodNode) {
      const rawRspCode = methodNode.rsp_code ?? methodNode.rspCode
      const rspCode: string | number | undefined =
        typeof rawRspCode === "string" || typeof rawRspCode === "number"
          ? rawRspCode
          : undefined
      if (rspCode != null && String(rspCode) !== "200" && Number(rspCode) !== 200) {
        const msg =
          (typeof methodNode.rsp_msg === "string" && methodNode.rsp_msg) ||
          (typeof methodNode.rspMsg === "string" && methodNode.rspMsg) ||
          "AliExpress business error"
        const codeNum = Number(rspCode)
        throw new AliExpressApiError(msg, {
          code: rspCode,
          rateLimited: codeNum === 40,
        })
      }
    }

    return json
  }

  async getProduct(productId: string): Promise<unknown> {
    const id = String(productId).trim()
    if (!id) throw new AliExpressApiError("product_id is required")
    return this.request("aliexpress.ds.product.get", { product_id: id })
  }
}

/** Build client with resolved session (env token or refresh). */
export async function createAliExpressClient(): Promise<AliExpressClient> {
  const config = readAliExpressConfig()
  const status = getAliExpressConfigStatus(config)
  if (!status.configured) {
    throw new AliExpressApiError(status.message)
  }
  const accessToken = await resolveAliExpressAccessToken(config)
  return new AliExpressClient({
    appKey: config.appKey,
    appSecret: config.appSecret,
    accessToken,
    sandbox: config.sandbox,
  })
}
