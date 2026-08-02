/**
 * AliExpress OAuth — exchange authorization code for access/refresh tokens.
 *
 * DS Open Platform (official): signed GET/POST /rest/auth/token/create
 * Legacy OAuth2: GET|POST /oauth/token (often 404/405 on SG).
 */

import {
  encodeAliExpressQuery,
  getAliExpressTimestamp,
  getAliExpressTimestampMs,
  signAliExpressIopHmacSha256,
  signAliExpressParams,
  signAliExpressParamsHmacSha256,
} from "@/lib/aliexpress-open-api"

export const ALIEXPRESS_OAUTH_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
export const ALIEXPRESS_REST_TOKEN_CREATE_URL =
  "https://api-sg.aliexpress.com/rest/auth/token/create"
export const ALIEXPRESS_REST_TOKEN_GET_URL =
  "https://api-sg.aliexpress.com/rest/auth/token/get"

/**
 * Must match the Redirect URI registered in AliExpress Open Platform exactly.
 */
export const DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI =
  "https://affisell-market.vercel.app/api/aliexpress/oauth/callback"

export function resolveAliExpressOAuthRedirectUri(): string {
  const fromEnv = process.env.ALIEXPRESS_OAUTH_REDIRECT_URI?.trim()
  return fromEnv || DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI
}

export type AliExpressTokenExchangeSuccess = {
  access_token: string
  refresh_token: string
  expires_in: number | null
  refresh_expires_in: number | null
  user_id: string | null
  seller_id: string | null
  account: string | null
  method: string
  raw: Record<string, unknown>
}

export type AliExpressTokenAttempt = {
  method: string
  url: string
  httpStatus: number
  bodyText: string
  body: unknown
}

export type AliExpressTokenExchangeResult =
  | {
      ok: true
      tokens: AliExpressTokenExchangeSuccess
      attempts: AliExpressTokenAttempt[]
      persisted?: boolean
    }
  | {
      ok: false
      httpStatus: number
      error: string
      body: unknown
      bodyText: string
      attempts: AliExpressTokenAttempt[]
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

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v)
  }
  return null
}

export { getAliExpressTimestamp, getAliExpressTimestampMs }

/** IOP HMAC-SHA256: apiPath + sorted(key+value) — re-export for tests/scripts. */
export function signAliExpressIopSha256(
  apiPath: string,
  params: Record<string, string>,
  appSecret: string
): string {
  return signAliExpressIopHmacSha256(apiPath, params, appSecret)
}

/** Log-safe mask — last 4 chars only (never full token). */
function maskToken(token: string): string {
  if (!token) return "(empty)"
  if (token.length <= 4) return `**** (len=${token.length})`
  return `…${token.slice(-4)} (len=${token.length})`
}

export function summarizeAliExpressTokens(tokens: AliExpressTokenExchangeSuccess) {
  return {
    method: tokens.method,
    access_token: maskToken(tokens.access_token),
    refresh_token: maskToken(tokens.refresh_token),
    expires_in: tokens.expires_in,
    refresh_expires_in: tokens.refresh_expires_in,
    user_id: tokens.user_id,
    seller_id: tokens.seller_id,
    account: tokens.account,
  }
}

function expiresAtFromSecondsOrMs(raw: number | null, fallbackSeconds: number): Date {
  if (raw == null || !Number.isFinite(raw)) {
    return new Date(Date.now() + fallbackSeconds * 1000)
  }
  // Absolute epoch ms vs relative seconds
  if (raw > 1e12) return new Date(raw)
  if (raw > 1e10) return new Date(raw) // epoch seconds*1000-ish
  return new Date(Date.now() + raw * 1000)
}

/** Best-effort persist after OAuth exchange (DB encrypted). Never throws. */
async function persistExchangedTokens(
  tokens: AliExpressTokenExchangeSuccess
): Promise<{ persisted: boolean; error?: string }> {
  try {
    const { saveAliExpressTokens } = await import("@/lib/aliexpress-token-store")
    const { clearAliExpressTokenMemoryCache } = await import("@/lib/aliexpress-oauth")
    const saved = await saveAliExpressTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessExpiresAt: expiresAtFromSecondsOrMs(tokens.expires_in, 86_400),
      refreshExpiresAt: tokens.refresh_expires_in
        ? expiresAtFromSecondsOrMs(tokens.refresh_expires_in, 172_800)
        : null,
      accountHint: tokens.account ?? tokens.seller_id ?? tokens.user_id,
      meta: {
        via: "oauth_token_exchange",
        method: tokens.method,
        exchangedAt: new Date().toISOString(),
      },
    })
    clearAliExpressTokenMemoryCache()
    if (!saved.ok) return { persisted: false, error: saved.error }
    return { persisted: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[aliexpress-oauth]", { result: "persist_error", message })
    return { persisted: false, error: message }
  }
}

function parseJsonLoose(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export function extractAliExpressTokenPayload(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json)
  if (!root) return null

  // AE business errors often come as HTTP 200 with { code, message }
  const code = pickString(root, ["code"])
  if (code && code !== "0" && !root.access_token && !root.gopResponseBody) {
    return null
  }

  const gopBody = root.gopResponseBody
  if (typeof gopBody === "string" && gopBody.trim()) {
    const inner = parseJsonLoose(gopBody)
    const innerRec = asRecord(inner)
    if (innerRec) return innerRec
  }

  return (
    asRecord(root.token_result) ??
    asRecord(root.aliexpress_auth_token_create_response) ??
    asRecord(root.data) ??
    root
  )
}

function tokensFromPayload(
  nested: Record<string, unknown>,
  method: string
): AliExpressTokenExchangeSuccess | null {
  const access_token = pickString(nested, ["access_token", "accessToken"])
  if (!access_token) return null
  return {
    access_token,
    refresh_token: pickString(nested, ["refresh_token", "refreshToken"]),
    expires_in: pickNumber(nested, ["expires_in", "expire_time", "expiresIn"]),
    refresh_expires_in: pickNumber(nested, [
      "refresh_expires_in",
      "refresh_token_valid_time",
      "refreshExpiresIn",
    ]),
    user_id: pickString(nested, ["user_id", "userId"]) || null,
    seller_id: pickString(nested, ["seller_id", "sellerId"]) || null,
    account: pickString(nested, ["account", "user_nick", "seller_login_id"]) || null,
    method,
    raw: nested,
  }
}

function errorMessageFromBody(json: unknown, fallback: string): string {
  const root = asRecord(json) ?? {}
  const errNode = asRecord(root.error_response) ?? root
  return (
    pickString(root, ["error_description", "error", "message", "msg"]) ||
    pickString(errNode, ["msg", "sub_msg", "message", "error_description", "error", "code"]) ||
    (typeof root.code === "string" && root.code !== "0" ? `${root.code}: ${String(root.message ?? "")}` : "") ||
    (typeof root.gopErrorCode === "string" && root.gopErrorCode !== "0"
      ? `gopErrorCode=${root.gopErrorCode}`
      : "") ||
    fallback
  )
}

function isFatalCodeError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes("invalid_grant") ||
    m.includes("code expired") ||
    m.includes("invalid code") ||
    m.includes("authorization code is invalid") ||
    m.includes("isv.code-invalid")
  )
}

async function runAttempt(
  method: string,
  url: string,
  init?: RequestInit
): Promise<AliExpressTokenAttempt> {
  let res: Response
  try {
    res = await fetch(url, { ...init, cache: "no-store" })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log("[aliexpress-oauth-exchange]", {
      method,
      url,
      httpStatus: 0,
      result: "network_error",
      bodyText: message,
    })
    return { method, url, httpStatus: 0, bodyText: message, body: { message } }
  }

  const bodyText = await res.text()
  const body = parseJsonLoose(bodyText)
  console.log("[aliexpress-oauth-exchange]", {
    method,
    url: url.split("?")[0],
    httpStatus: res.status,
    bodyText: bodyText.slice(0, 4000),
  })
  return {
    method,
    url: url.split("?")[0]!,
    httpStatus: res.status,
    bodyText,
    body,
  }
}

type RestSignMode = "iop-sha256" | "top-md5" | "top-hmac"

function buildSignedRestRequest(args: {
  apiPath: "/auth/token/create" | "/auth/token/get"
  code: string
  clientId: string
  clientSecret: string
  timestampMode: "ms" | "beijing"
  signMode: RestSignMode
  signMethodParam: string
}): { url: string; formBody: string; params: Record<string, string>; label: string } {
  const base =
    args.apiPath === "/auth/token/get"
      ? ALIEXPRESS_REST_TOKEN_GET_URL
      : ALIEXPRESS_REST_TOKEN_CREATE_URL

  const timestamp =
    args.timestampMode === "ms" ? getAliExpressTimestampMs() : getAliExpressTimestamp()

  const params: Record<string, string> = {
    app_key: args.clientId,
    code: args.code,
    sign_method: args.signMethodParam,
    timestamp,
  }

  if (args.signMode === "iop-sha256") {
    params.sign = signAliExpressIopHmacSha256(args.apiPath, params, args.clientSecret)
  } else if (args.signMode === "top-hmac") {
    params.sign = signAliExpressParamsHmacSha256(params, args.clientSecret)
  } else {
    params.sign = signAliExpressParams(params, args.clientSecret)
  }

  const query = encodeAliExpressQuery(params)
  const label = `${args.apiPath} ${args.timestampMode} ${args.signMode}`

  console.log("[aliexpress-oauth-exchange]", {
    method: `sign ${label}`,
    timestamp,
    timestampMode: args.timestampMode,
    sign_method: args.signMethodParam,
    spaceEncoding: "%20",
  })

  return {
    url: `${base}?${query}`,
    formBody: query,
    params,
    label,
  }
}

function pickBestFailure(attempts: AliExpressTokenAttempt[]): AliExpressTokenAttempt {
  // Prefer AE business errors (HTTP 200 + code) over empty 404 oauth endpoints
  for (const a of attempts) {
    const root = asRecord(a.body)
    if (root && (root.code || root.error_response || root.message)) return a
  }
  for (const a of [...attempts].reverse()) {
    if (a.bodyText.trim()) return a
  }
  return attempts[attempts.length - 1]!
}

/**
 * Exchange `code` for tokens.
 * Priority: IOP ms+sha256 (DS) → Beijing datetime MD5 → POST variants → legacy oauth.
 */
export async function exchangeAliExpressAuthorizationCode(args: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri?: string
}): Promise<AliExpressTokenExchangeResult> {
  const code = args.code.trim()
  const clientId = args.clientId.trim()
  const clientSecret = args.clientSecret.trim()
  const redirectUri = (args.redirectUri ?? resolveAliExpressOAuthRedirectUri()).trim()
  const attempts: AliExpressTokenAttempt[] = []

  if (!code) {
    return {
      ok: false,
      httpStatus: 400,
      error: "missing_code",
      body: null,
      bodyText: "",
      attempts,
    }
  }
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      httpStatus: 500,
      error: "missing_app_credentials",
      body: { missing: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"] },
      bodyText: "missing_app_credentials",
      attempts,
    }
  }

  const oauthParams = {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  }
  const oauthQuery = encodeAliExpressQuery(oauthParams)

  type Step = { method: string; run: () => Promise<AliExpressTokenAttempt> }
  const plan: Step[] = []

  const restVariants: Array<{
    apiPath: "/auth/token/create" | "/auth/token/get"
    timestampMode: "ms" | "beijing"
    signMode: RestSignMode
    signMethodParam: string
    http: "GET" | "POST"
  }> = [
    // Working pattern from IOP / community SDKs for DS apps
    {
      apiPath: "/auth/token/create",
      timestampMode: "ms",
      signMode: "iop-sha256",
      signMethodParam: "sha256",
      http: "GET",
    },
    {
      apiPath: "/auth/token/create",
      timestampMode: "ms",
      signMode: "iop-sha256",
      signMethodParam: "sha256",
      http: "POST",
    },
    {
      apiPath: "/auth/token/create",
      timestampMode: "ms",
      signMode: "iop-sha256",
      signMethodParam: "hmac-sha256",
      http: "GET",
    },
    // Classic TOP datetime + MD5 (refresh path style), with %20 encoding
    {
      apiPath: "/auth/token/create",
      timestampMode: "beijing",
      signMode: "top-md5",
      signMethodParam: "md5",
      http: "GET",
    },
    {
      apiPath: "/auth/token/create",
      timestampMode: "beijing",
      signMode: "top-md5",
      signMethodParam: "md5",
      http: "POST",
    },
    {
      apiPath: "/auth/token/create",
      timestampMode: "beijing",
      signMode: "iop-sha256",
      signMethodParam: "sha256",
      http: "GET",
    },
    {
      apiPath: "/auth/token/create",
      timestampMode: "beijing",
      signMode: "top-hmac",
      signMethodParam: "sha256",
      http: "GET",
    },
    {
      apiPath: "/auth/token/get",
      timestampMode: "ms",
      signMode: "iop-sha256",
      signMethodParam: "sha256",
      http: "GET",
    },
    {
      apiPath: "/auth/token/get",
      timestampMode: "beijing",
      signMode: "top-md5",
      signMethodParam: "md5",
      http: "GET",
    },
  ]

  for (const v of restVariants) {
    const method = `${v.http} ${v.apiPath} ${v.timestampMode} ${v.signMode}`
    plan.push({
      method,
      run: async () => {
        const built = buildSignedRestRequest({
          apiPath: v.apiPath,
          code,
          clientId,
          clientSecret,
          timestampMode: v.timestampMode,
          signMode: v.signMode,
          signMethodParam: v.signMethodParam,
        })
        if (v.http === "POST") {
          return runAttempt(method, built.url.split("?")[0]!, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
              Accept: "application/json",
            },
            body: built.formBody,
          })
        }
        return runAttempt(method, built.url, {
          method: "GET",
          headers: { Accept: "application/json" },
        })
      },
    })
  }

  plan.push(
    {
      method: "GET oauth/token",
      run: () =>
        runAttempt("GET oauth/token", `${ALIEXPRESS_OAUTH_TOKEN_URL}?${oauthQuery}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        }),
    },
    {
      method: "POST oauth/token form",
      run: () =>
        runAttempt("POST oauth/token form", ALIEXPRESS_OAUTH_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            Accept: "application/json",
          },
          body: oauthQuery,
        }),
    }
  )

  for (const step of plan) {
    const attempt = await step.run()
    attempts.push(attempt)

    const nested = extractAliExpressTokenPayload(attempt.body)
    const tokens = nested ? tokensFromPayload(nested, attempt.method) : null
    if (tokens) {
      const persist = await persistExchangedTokens(tokens)
      console.log("[aliexpress-oauth]", {
        result: "exchange_ok",
        ...summarizeAliExpressTokens(tokens),
        persisted: persist.persisted,
        persistError: persist.error ?? null,
      })
      return { ok: true, tokens, attempts, persisted: persist.persisted }
    }

    const msg = errorMessageFromBody(attempt.body, attempt.bodyText)
    if (isFatalCodeError(msg)) break
  }

  const best = pickBestFailure(attempts)
  const detail = errorMessageFromBody(
    best.body,
    best.bodyText || `http_${best.httpStatus || 502}`
  )
  const error =
    detail && !detail.startsWith("http_")
      ? `${detail} (via ${best.method}, http_${best.httpStatus})`
      : `http_${best.httpStatus}${best.bodyText ? `: ${best.bodyText.slice(0, 500)}` : ""}`

  return {
    ok: false,
    httpStatus: best.httpStatus > 0 ? best.httpStatus : 502,
    error,
    body: {
      attempts: attempts.map((a) => ({
        method: a.method,
        url: a.url,
        httpStatus: a.httpStatus,
        body: a.body,
        bodyText: a.bodyText.slice(0, 2000),
      })),
      best: best.body,
    },
    bodyText: best.bodyText,
    attempts,
  }
}

export function buildAliExpressAuthorizeUrl(appKey: string, redirectUri?: string): string {
  const uri = encodeURIComponent(redirectUri ?? resolveAliExpressOAuthRedirectUri())
  const clientId = encodeURIComponent(appKey.trim())
  return `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${uri}&client_id=${clientId}`
}
