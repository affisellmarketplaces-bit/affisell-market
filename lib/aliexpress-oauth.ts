import "server-only"

import { readAliExpressConfig } from "@/lib/aliexpress-config"
import {
  AliExpressApiError,
  encodeAliExpressQuery,
  getAliExpressTimestamp,
  getAliExpressTimestampMs,
  signAliExpressIopHmacSha256,
  signAliExpressParams,
} from "@/lib/aliexpress-open-api"
import {
  expiresWithinMs,
  loadAliExpressTokens,
  saveAliExpressTokens,
  type AliExpressStoredTokens,
} from "@/lib/aliexpress-token-store"

const REFRESH_TIMEOUT_MS = 15_000
/** Refresh when access token expires within this window. */
export const ALIEXPRESS_REFRESH_SKEW_MS = 60 * 60 * 1000

let memoryCache: {
  accessToken: string
  refreshToken: string
  accessExpiresAtMs: number
} | null = null

export function clearAliExpressTokenMemoryCache(): void {
  memoryCache = null
}

function refreshEndpoints(): string[] {
  // DS apps (SG) first — matches token/create host that works for App 534690
  return [
    "https://api-sg.aliexpress.com/rest/auth/token/refresh",
    "https://api.aliexpress.com/rest/auth/token/refresh",
  ]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function pickExpiresAtMs(tokenNode: Record<string, unknown>, fallbackSeconds = 86_400): number {
  const expireRaw = tokenNode.expire_time ?? tokenNode.expires_in ?? tokenNode.expiresIn
  if (typeof expireRaw === "number" && Number.isFinite(expireRaw)) {
    return expireRaw > 1e12 ? expireRaw : Date.now() + expireRaw * 1000
  }
  if (typeof expireRaw === "string" && expireRaw.trim()) {
    const n = Number(expireRaw)
    if (Number.isFinite(n)) {
      return n > 1e12 ? n : Date.now() + n * 1000
    }
  }
  return Date.now() + fallbackSeconds * 1000
}

function pickRefreshExpiresAt(tokenNode: Record<string, unknown>): Date | null {
  const raw =
    tokenNode.refresh_token_valid_time ??
    tokenNode.refresh_expires_in ??
    tokenNode.refreshExpiresIn
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw > 1e12 ? raw : Date.now() + raw * 1000)
  }
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
    const n = Number(raw)
    return new Date(n > 1e12 ? n : Date.now() + n * 1000)
  }
  return null
}

async function callRefreshEndpoint(args: {
  url: string
  method: "GET" | "POST"
  body?: string
}): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)
  try {
    const res = await fetch(args.url, {
      method: args.method,
      headers: {
        Accept: "application/json",
        ...(args.body
          ? { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }
          : {}),
      },
      body: args.body,
      signal: controller.signal,
      cache: "no-store",
    })
    const text = await res.text()
    try {
      return text ? JSON.parse(text) : null
    } catch {
      throw new AliExpressApiError(`AliExpress token refresh non-JSON (HTTP ${res.status})`)
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AliExpressApiError("AliExpress token refresh timed out")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

function parseRefreshResponse(
  json: unknown,
  fallbackRefresh: string
): { accessToken: string; refreshToken: string; expiresAtMs: number; refreshExpiresAt: Date | null } {
  const root = asRecord(json) ?? {}
  if (root.type === "ISV" || root.error_response) {
    const err = asRecord(root.error_response) ?? root
    const msg =
      pickString(err, ["message", "msg", "sub_msg", "error"]) ||
      pickString(root, ["message", "code"]) ||
      "AliExpress token refresh failed"
    throw new AliExpressApiError(msg)
  }

  const gop = root.gopResponseBody
  let tokenNode = root
  if (typeof gop === "string" && gop.trim()) {
    try {
      tokenNode = asRecord(JSON.parse(gop)) ?? root
    } catch {
      /* keep */
    }
  } else {
    tokenNode =
      asRecord(root.token_result) ??
      asRecord(root.aliexpress_token_refresh_response) ??
      root
  }

  const accessToken = pickString(tokenNode, ["access_token", "accessToken"])
  if (!accessToken) {
    throw new AliExpressApiError("AliExpress token refresh did not return an access_token")
  }
  const refreshToken =
    pickString(tokenNode, ["refresh_token", "refreshToken"]) || fallbackRefresh

  return {
    accessToken,
    refreshToken,
    expiresAtMs: pickExpiresAtMs(tokenNode),
    refreshExpiresAt: pickRefreshExpiresAt(tokenNode),
  }
}

/**
 * Refresh via IOP (ms + sha256) then TOP MD5 Beijing — same lessons as token/create.
 */
export async function refreshAliExpressAccessToken(args?: {
  refreshToken?: string
  appKey?: string
  appSecret?: string
  sandbox?: boolean
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  refreshExpiresAt: Date | null
}> {
  const config = readAliExpressConfig()
  const appKey = (args?.appKey ?? config.appKey).trim()
  const appSecret = (args?.appSecret ?? config.appSecret).trim()
  const refreshToken = (args?.refreshToken ?? config.refreshToken).trim()

  if (!refreshToken) {
    throw new AliExpressApiError("ALIEXPRESS_REFRESH_TOKEN is required to refresh the access token")
  }
  if (!appKey || !appSecret) {
    throw new AliExpressApiError("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET required")
  }

  const apiPath = "/auth/token/refresh"
  const attempts: Array<{ label: string; run: () => Promise<unknown> }> = []

  for (const base of refreshEndpoints()) {
    const hostLabel = base.includes("api-sg") ? "sg" : "global"
    attempts.push(
      {
        label: `GET refresh iop-ms-sha256 (${hostLabel})`,
        run: () => {
          const params: Record<string, string> = {
            app_key: appKey,
            refresh_token: refreshToken,
            sign_method: "sha256",
            timestamp: getAliExpressTimestampMs(),
          }
          params.sign = signAliExpressIopHmacSha256(apiPath, params, appSecret)
          return callRefreshEndpoint({
            url: `${base}?${encodeAliExpressQuery(params)}`,
            method: "GET",
          })
        },
      },
      {
        label: `POST refresh iop-ms-sha256 (${hostLabel})`,
        run: () => {
          const params: Record<string, string> = {
            app_key: appKey,
            refresh_token: refreshToken,
            sign_method: "sha256",
            timestamp: getAliExpressTimestampMs(),
          }
          params.sign = signAliExpressIopHmacSha256(apiPath, params, appSecret)
          const body = encodeAliExpressQuery(params)
          return callRefreshEndpoint({ url: base, method: "POST", body })
        },
      },
      {
        label: `GET refresh top-md5-beijing (${hostLabel})`,
        run: () => {
          const params: Record<string, string> = {
            app_key: appKey,
            refresh_token: refreshToken,
            sign_method: "md5",
            timestamp: getAliExpressTimestamp(),
          }
          params.sign = signAliExpressParams(params, appSecret)
          return callRefreshEndpoint({
            url: `${base}?${encodeAliExpressQuery(params)}`,
            method: "GET",
          })
        },
      }
    )
  }

  let lastError: unknown = null
  for (const step of attempts) {
    try {
      const json = await step.run()
      const parsed = parseRefreshResponse(json, refreshToken)
      console.log("[aliexpress-oauth]", {
        result: "refresh_ok",
        method: step.label,
        access: `…${parsed.accessToken.slice(-4)}`,
        expiresAt: new Date(parsed.expiresAtMs).toISOString(),
      })
      return parsed
    } catch (err) {
      lastError = err
      console.log("[aliexpress-oauth]", {
        result: "refresh_attempt_failed",
        method: step.label,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AliExpressApiError("AliExpress token refresh failed")
}

function tokensNeedRefresh(stored: AliExpressStoredTokens): boolean {
  if (!stored.accessToken) return true
  return expiresWithinMs(stored.accessExpiresAt, ALIEXPRESS_REFRESH_SKEW_MS)
}

/**
 * Returns a non-expired access token (DB → env → refresh). Persists refreshed tokens.
 */
export async function getValidAccessToken(options?: {
  forceRefresh?: boolean
}): Promise<string> {
  const force = options?.forceRefresh === true

  if (
    !force &&
    memoryCache &&
    memoryCache.accessToken &&
    memoryCache.accessExpiresAtMs - Date.now() > ALIEXPRESS_REFRESH_SKEW_MS
  ) {
    return memoryCache.accessToken
  }

  const stored = await loadAliExpressTokens()
  if (!stored?.refreshToken && !stored?.accessToken) {
    throw new AliExpressApiError(
      "AliExpress tokens missing — run OAuth callback or set ALIEXPRESS_ACCESS_TOKEN / ALIEXPRESS_REFRESH_TOKEN"
    )
  }

  if (!force && stored.accessToken && !tokensNeedRefresh(stored)) {
    memoryCache = {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      accessExpiresAtMs: stored.accessExpiresAt?.getTime() ?? Date.now() + 86_400_000,
    }
    return stored.accessToken
  }

  if (!stored.refreshToken) {
    if (stored.accessToken) return stored.accessToken
    throw new AliExpressApiError("ALIEXPRESS_REFRESH_TOKEN required to renew access token")
  }

  const refreshed = await refreshAliExpressAccessToken({
    refreshToken: stored.refreshToken,
  })

  memoryCache = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessExpiresAtMs: refreshed.expiresAtMs,
  }

  await saveAliExpressTokens({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessExpiresAt: new Date(refreshed.expiresAtMs),
    refreshExpiresAt: refreshed.refreshExpiresAt,
    accountHint: stored.accountHint,
    meta: { refreshedAt: new Date().toISOString(), source: stored.source },
  })

  return refreshed.accessToken
}

/** Force refresh + persist — used by cron. */
export async function forceRefreshAndPersistAliExpressTokens(): Promise<{
  ok: true
  expiresIn: number
  accessExpiresAt: string
  persisted: boolean
}> {
  const stored = await loadAliExpressTokens()
  if (!stored?.refreshToken) {
    throw new AliExpressApiError("No refresh_token available (DB or env)")
  }

  const refreshed = await refreshAliExpressAccessToken({
    refreshToken: stored.refreshToken,
  })

  memoryCache = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessExpiresAtMs: refreshed.expiresAtMs,
  }

  const saved = await saveAliExpressTokens({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessExpiresAt: new Date(refreshed.expiresAtMs),
    refreshExpiresAt: refreshed.refreshExpiresAt,
    accountHint: stored.accountHint,
    meta: { refreshedAt: new Date().toISOString(), via: "force_refresh" },
  })

  const expiresIn = Math.max(0, Math.round((refreshed.expiresAtMs - Date.now()) / 1000))

  return {
    ok: true,
    expiresIn,
    accessExpiresAt: new Date(refreshed.expiresAtMs).toISOString(),
    persisted: saved.ok,
  }
}

/** @deprecated Prefer getValidAccessToken — kept for open-api createAliExpressClient. */
export async function resolveAliExpressAccessToken(): Promise<string> {
  return getValidAccessToken()
}
