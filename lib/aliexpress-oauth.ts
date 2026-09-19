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
  AliExpressTokenStoreUnavailableError,
  expiresWithinMs,
  loadAliExpressTokens,
  loadAliExpressTokenState,
  saveAliExpressTokens,
  type AliExpressStoredTokens,
} from "@/lib/aliexpress-token-store"

const REFRESH_TIMEOUT_MS = 15_000
/**
 * Refresh when the access token expires within this window. Wide on purpose: the cron runs every 6h, so a token is
 * always renewed well before it dies, even if one cron run is lost to a database / network hiccup.
 */
export const ALIEXPRESS_REFRESH_SKEW_MS = 8 * 60 * 60 * 1000

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
    // A structured answer without a token = AliExpress REJECTED the refresh token (expired / revoked / rotated).
    const reason =
      pickString(tokenNode, ["message", "msg", "error_description", "sub_msg", "error", "code"]) ||
      pickString(root, ["message", "msg", "error_description", "error", "code"]) ||
      `keys: ${Object.keys(tokenNode).slice(0, 6).join(",") || "none"}`
    throw new AliExpressApiError(`AliExpress refresh token rejected — did not return an access_token (${reason.slice(0, 120)})`)
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
  const failures: unknown[] = []
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
      failures.push(err)
      console.log("[aliexpress-oauth]", {
        result: "refresh_attempt_failed",
        method: step.label,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Report the MOST INFORMATIVE failure, not merely the last one: the global host answering with HTML or a
  // wrong-sign attempt is noise, while "refresh token rejected" from the DS host is the real verdict.
  const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))
  const rejected = failures.find((e) => /refresh token rejected/i.test(messageOf(e)))
  if (rejected instanceof Error) throw rejected
  const informative = failures.find((e) => !/non-json|timestamp is invalid/i.test(messageOf(e)))
  if (informative instanceof Error) throw informative
  throw lastError instanceof Error
    ? lastError
    : new AliExpressApiError("AliExpress token refresh failed")
}

function tokensNeedRefresh(stored: AliExpressStoredTokens): boolean {
  if (!stored.accessToken) return true
  return expiresWithinMs(stored.accessExpiresAt, ALIEXPRESS_REFRESH_SKEW_MS)
}

type RefreshedTokens = {
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  refreshExpiresAt: Date | null
}

/** Network / gateway / DB trouble — says nothing about the validity of the session. */
export function isTransientAliExpressFailure(err: unknown): boolean {
  if (err instanceof AliExpressTokenStoreUnavailableError) return true
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // NOT "non-json": a gateway/HTML answer says nothing about the network, and must never mask a rejected token.
  return /timed out|timeout|http 5\d\d|fetch failed|econnreset|enotfound|etimedout|network|temporar|unavailable/.test(m)
}

/** One refresh at a time per instance — parallel refreshes would rotate the refresh token under each other. */
let refreshInFlight: Promise<RefreshedTokens> | null = null

async function refreshRotateAndPersist(
  stored: AliExpressStoredTokens,
  meta: Record<string, unknown>
): Promise<RefreshedTokens & { persisted: boolean }> {
  if (refreshInFlight) {
    const shared = await refreshInFlight
    return { ...shared, persisted: true }
  }

  const run = (async (): Promise<RefreshedTokens & { persisted: boolean }> => {
    let refreshed: RefreshedTokens
    try {
      refreshed = await refreshAliExpressAccessToken({ refreshToken: stored.refreshToken })
    } catch (err) {
      // Another instance may have rotated the token first (AliExpress invalidates the previous one):
      // adopt what it stored instead of declaring the session dead.
      const latest = await loadAliExpressTokenState()
      if (latest.status === "ok" && latest.tokens.refreshToken && latest.tokens.refreshToken !== stored.refreshToken) {
        const t = latest.tokens
        if (t.accessToken && t.accessExpiresAt && !expiresWithinMs(t.accessExpiresAt, 5 * 60 * 1000)) {
          console.log("[aliexpress-oauth]", { result: "adopted_tokens_rotated_elsewhere" })
          return {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAtMs: t.accessExpiresAt.getTime(),
            refreshExpiresAt: t.refreshExpiresAt,
            persisted: true,
          }
        }
        refreshed = await refreshAliExpressAccessToken({ refreshToken: t.refreshToken })
      } else {
        throw err
      }
    }

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
      meta: { ...meta, refreshedAt: new Date().toISOString(), source: stored.source },
    })
    if (!saved.ok) {
      console.error("[aliexpress-oauth]", {
        result: "CRITICAL_rotated_tokens_not_persisted",
        error: saved.error,
      })
    }
    return { ...refreshed, persisted: saved.ok }
  })()

  refreshInFlight = run
  try {
    return await run
  } finally {
    refreshInFlight = null
  }
}

/**
 * Returns a non-expired access token (DB → env bootstrap → refresh). Persists refreshed tokens.
 * A transient failure (network, DB) never invalidates the session: the current access token is reused while it lives.
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

  let stored: AliExpressStoredTokens | null
  try {
    stored = await loadAliExpressTokens()
  } catch (err) {
    // Database outage: keep serving from memory while that token is still valid.
    if (memoryCache && memoryCache.accessExpiresAtMs - Date.now() > 60_000) return memoryCache.accessToken
    throw err
  }
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

  try {
    const refreshed = await refreshRotateAndPersist(stored, {})
    return refreshed.accessToken
  } catch (err) {
    const stillLive =
      stored.accessToken &&
      stored.accessExpiresAt &&
      stored.accessExpiresAt.getTime() - Date.now() > 60_000
    if (!force && stillLive && isTransientAliExpressFailure(err)) {
      console.warn("[aliexpress-oauth]", { result: "refresh_transient_failure_reusing_access_token" })
      return stored.accessToken
    }
    throw err
  }
}

/** Force refresh + persist — used by cron. */
export async function forceRefreshAndPersistAliExpressTokens(): Promise<{
  ok: true
  expiresIn: number
  accessExpiresAt: string
  refreshExpiresAt: string | null
  persisted: boolean
}> {
  const stored = await loadAliExpressTokens()
  if (!stored?.refreshToken) {
    throw new AliExpressApiError("No refresh_token available (DB or env)")
  }

  const refreshed = await refreshRotateAndPersist(stored, { via: "force_refresh" })
  const expiresIn = Math.max(0, Math.round((refreshed.expiresAtMs - Date.now()) / 1000))

  return {
    ok: true,
    expiresIn,
    accessExpiresAt: new Date(refreshed.expiresAtMs).toISOString(),
    refreshExpiresAt: refreshed.refreshExpiresAt?.toISOString() ?? null,
    persisted: refreshed.persisted,
  }
}

/** @deprecated Prefer getValidAccessToken — kept for open-api createAliExpressClient. */
export async function resolveAliExpressAccessToken(): Promise<string> {
  return getValidAccessToken()
}
