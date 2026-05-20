import { signAliExpressParams, AliExpressApiError } from "@/lib/aliexpress-open-api"
import type { AliExpressEnvConfig } from "@/lib/aliexpress-config"

const REFRESH_TIMEOUT_MS = 10_000

let cachedAccessToken: string | null = null
let cachedExpiresAtMs = 0

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function refreshBaseUrl(sandbox: boolean): string {
  return sandbox
    ? "https://api-sg.aliexpress.com/rest/auth/token/refresh"
    : "https://api.aliexpress.com/rest/auth/token/refresh"
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Refresh access token via AliExpress REST auth (uses refresh_token). */
export async function refreshAliExpressAccessToken(
  config: Pick<AliExpressEnvConfig, "appKey" | "appSecret" | "refreshToken" | "sandbox">
): Promise<{ accessToken: string; refreshToken: string; expiresAtMs: number }> {
  if (!config.refreshToken) {
    throw new AliExpressApiError("ALIEXPRESS_REFRESH_TOKEN is required to refresh the access token")
  }

  const params: Record<string, string> = {
    app_key: config.appKey,
    refresh_token: config.refreshToken,
    sign_method: "md5",
    timestamp: formatTimestamp(),
  }
  params.sign = signAliExpressParams(params, config.appSecret)

  const url = `${refreshBaseUrl(config.sandbox)}?${new URLSearchParams(params).toString()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, { method: "GET", signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AliExpressApiError("AliExpress token refresh timed out")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new AliExpressApiError(`AliExpress token refresh returned non-JSON (HTTP ${res.status})`)
  }

  const root = asRecord(json)
  const err = root ? asRecord(root.error_response) : null
  if (err) {
    const msg =
      (typeof err.msg === "string" && err.msg) ||
      (typeof err.sub_msg === "string" && err.sub_msg) ||
      "AliExpress token refresh failed"
    throw new AliExpressApiError(msg)
  }

  const tokenNode =
    asRecord(root?.token_result) ??
    asRecord(root?.aliexpress_token_refresh_response) ??
    root

  const accessToken =
    (typeof tokenNode?.access_token === "string" && tokenNode.access_token) ||
    (typeof tokenNode?.accessToken === "string" && tokenNode.accessToken) ||
    ""

  if (!accessToken) {
    throw new AliExpressApiError("AliExpress token refresh did not return an access_token")
  }

  const refreshToken =
    (typeof tokenNode?.refresh_token === "string" && tokenNode.refresh_token) ||
    (typeof tokenNode?.refreshToken === "string" && tokenNode.refreshToken) ||
    config.refreshToken

  const expireRaw = tokenNode?.expire_time ?? tokenNode?.expires_in ?? tokenNode?.expiresIn
  let expiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000
  if (typeof expireRaw === "number" && Number.isFinite(expireRaw)) {
    expiresAtMs = expireRaw > 1e12 ? expireRaw : Date.now() + expireRaw * 1000
  } else if (typeof expireRaw === "string" && expireRaw.trim()) {
    const n = Number(expireRaw)
    if (Number.isFinite(n)) {
      expiresAtMs = n > 1e12 ? n : Date.now() + n * 1000
    }
  }

  return { accessToken, refreshToken, expiresAtMs }
}

/** Resolve session token: env access token, in-memory cache, or refresh. */
export async function resolveAliExpressAccessToken(
  config: AliExpressEnvConfig
): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedExpiresAtMs - 60_000) {
    return cachedAccessToken
  }

  if (config.accessToken) {
    return config.accessToken
  }

  if (config.refreshToken && config.appKey && config.appSecret) {
    const refreshed = await refreshAliExpressAccessToken(config)
    cachedAccessToken = refreshed.accessToken
    cachedExpiresAtMs = refreshed.expiresAtMs
    return refreshed.accessToken
  }

  throw new AliExpressApiError(
    "AliExpress access token is not configured (set ALIEXPRESS_ACCESS_TOKEN or ALIEXPRESS_REFRESH_TOKEN on Vercel)"
  )
}
