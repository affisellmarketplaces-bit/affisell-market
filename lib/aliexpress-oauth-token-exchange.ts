/**
 * AliExpress OAuth — exchange authorization code for access/refresh tokens.
 *
 * DS Open Platform (official): signed GET /rest/auth/token/create
 * Legacy OAuth2: GET|POST /oauth/token (POST often returns 405 on SG).
 */

import crypto from "crypto"

import { signAliExpressParams } from "@/lib/aliexpress-open-api"

export const ALIEXPRESS_OAUTH_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
export const ALIEXPRESS_REST_TOKEN_CREATE_URL =
  "https://api-sg.aliexpress.com/rest/auth/token/create"
export const ALIEXPRESS_REST_TOKEN_GET_URL =
  "https://api-sg.aliexpress.com/rest/auth/token/get"

/**
 * Must match the Redirect URI registered in AliExpress Open Platform exactly.
 * Override only for deliberate local/staging experiments (AE console must match).
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
  | { ok: true; tokens: AliExpressTokenExchangeSuccess; attempts: AliExpressTokenAttempt[] }
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

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** IOP HMAC-SHA256 sign: apiPath + sorted(key+value), hex uppercase. */
export function signAliExpressIopSha256(
  apiPath: string,
  params: Record<string, string>,
  appSecret: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
  let base = apiPath
  for (const key of sortedKeys) {
    base += key + params[key]!
  }
  return crypto.createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase()
}

function maskToken(token: string): string {
  if (token.length <= 10) return `…(len=${token.length})`
  return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`
}

/** Safe log payload — never dump full secrets. */
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

function parseJsonLoose(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/** Unwrap AE token payloads (flat, token_result, gopResponseBody JSON string, etc.). */
export function extractAliExpressTokenPayload(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json)
  if (!root) return null

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
    pickString(errNode, ["msg", "sub_msg", "message", "error_description", "error"]) ||
    (typeof root.gopErrorCode === "string" && root.gopErrorCode !== "0"
      ? `gopErrorCode=${root.gopErrorCode}`
      : "") ||
    fallback
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
    return {
      method,
      url,
      httpStatus: 0,
      bodyText: message,
      body: { message },
    }
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

function buildSignedRestCreateUrl(args: {
  apiPath: "/auth/token/create" | "/auth/token/get"
  code: string
  clientId: string
  clientSecret: string
  signMethod: "md5" | "sha256"
}): string {
  const base =
    args.apiPath === "/auth/token/get"
      ? ALIEXPRESS_REST_TOKEN_GET_URL
      : ALIEXPRESS_REST_TOKEN_CREATE_URL

  const params: Record<string, string> = {
    app_key: args.clientId,
    code: args.code,
    sign_method: args.signMethod,
    timestamp: formatTimestamp(),
  }
  params.sign =
    args.signMethod === "sha256"
      ? signAliExpressIopSha256(args.apiPath, params, args.clientSecret)
      : signAliExpressParams(params, args.clientSecret)

  return `${base}?${new URLSearchParams(params).toString()}`
}

/**
 * Exchange `code` for tokens. Tries DS REST create (signed) then legacy OAuth GET/POST.
 * AE codes are single-use (~10 min TTL).
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

  const oauthQuery = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const plan: Array<{ method: string; run: () => Promise<AliExpressTokenAttempt> }> = [
    // 1) Official DS Open Platform — same pattern as /auth/token/refresh
    {
      method: "GET rest/auth/token/create md5",
      run: () =>
        runAttempt(
          "GET rest/auth/token/create md5",
          buildSignedRestCreateUrl({
            apiPath: "/auth/token/create",
            code,
            clientId,
            clientSecret,
            signMethod: "md5",
          }),
          { method: "GET", headers: { Accept: "application/json" } }
        ),
    },
    {
      method: "GET rest/auth/token/create sha256",
      run: () =>
        runAttempt(
          "GET rest/auth/token/create sha256",
          buildSignedRestCreateUrl({
            apiPath: "/auth/token/create",
            code,
            clientId,
            clientSecret,
            signMethod: "sha256",
          }),
          { method: "GET", headers: { Accept: "application/json" } }
        ),
    },
    {
      method: "GET rest/auth/token/get md5",
      run: () =>
        runAttempt(
          "GET rest/auth/token/get md5",
          buildSignedRestCreateUrl({
            apiPath: "/auth/token/get",
            code,
            clientId,
            clientSecret,
            signMethod: "md5",
          }),
          { method: "GET", headers: { Accept: "application/json" } }
        ),
    },
    // 2) Legacy OAuth2 — GET first (old SDK); POST often 405 on api-sg
    {
      method: "GET oauth/token",
      run: () =>
        runAttempt("GET oauth/token", `${ALIEXPRESS_OAUTH_TOKEN_URL}?${oauthQuery.toString()}`, {
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
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: oauthQuery,
        }),
    },
  ]

  for (const step of plan) {
    const attempt = await step.run()
    attempts.push(attempt)

    const nested = extractAliExpressTokenPayload(attempt.body)
    const tokens = nested ? tokensFromPayload(nested, attempt.method) : null
    if (tokens) {
      return { ok: true, tokens, attempts }
    }

    // Stop early on clear invalid_grant / expired code — no point burning more attempts
    const msg = errorMessageFromBody(attempt.body, "").toLowerCase()
    if (
      msg.includes("invalid_grant") ||
      msg.includes("code expired") ||
      msg.includes("expire") ||
      msg.includes("invalid code")
    ) {
      break
    }
  }

  const last = attempts[attempts.length - 1]
  const lastBody = last?.body ?? null
  const lastText = last?.bodyText ?? ""
  const detail = errorMessageFromBody(lastBody, lastText || `http_${last?.httpStatus ?? 502}`)
  const error =
    detail && detail !== `http_${last?.httpStatus ?? 502}`
      ? `${detail} (http_${last?.httpStatus ?? 502})`
      : `http_${last?.httpStatus ?? 502}${lastText ? `: ${lastText.slice(0, 500)}` : ""}`

  return {
    ok: false,
    httpStatus: last?.httpStatus && last.httpStatus > 0 ? last.httpStatus : 502,
    error,
    body: {
      attempts: attempts.map((a) => ({
        method: a.method,
        url: a.url,
        httpStatus: a.httpStatus,
        body: a.body,
        bodyText: a.bodyText.slice(0, 2000),
      })),
      last: lastBody,
    },
    bodyText: lastText,
    attempts,
  }
}

export function buildAliExpressAuthorizeUrl(appKey: string, redirectUri?: string): string {
  const uri = encodeURIComponent(redirectUri ?? resolveAliExpressOAuthRedirectUri())
  const clientId = encodeURIComponent(appKey.trim())
  return `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${uri}&client_id=${clientId}`
}
