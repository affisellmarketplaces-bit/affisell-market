/**
 * AliExpress OAuth2 — exchange authorization code for access/refresh tokens.
 * NEW Open Platform endpoint (SG): POST /oauth/token
 */

export const ALIEXPRESS_OAUTH_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"

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
  raw: Record<string, unknown>
}

export type AliExpressTokenExchangeResult =
  | { ok: true; tokens: AliExpressTokenExchangeSuccess }
  | { ok: false; httpStatus: number; error: string; body: unknown }

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

function maskToken(token: string): string {
  if (token.length <= 10) return `…(len=${token.length})`
  return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`
}

/** Safe log payload — never dump full secrets. */
export function summarizeAliExpressTokens(tokens: AliExpressTokenExchangeSuccess) {
  return {
    access_token: maskToken(tokens.access_token),
    refresh_token: maskToken(tokens.refresh_token),
    expires_in: tokens.expires_in,
    refresh_expires_in: tokens.refresh_expires_in,
    user_id: tokens.user_id,
    seller_id: tokens.seller_id,
    account: tokens.account,
  }
}

/**
 * Exchange `code` for tokens via AliExpress OAuth2 token endpoint.
 * Idempotent for a given code: AE codes are single-use (~10 min TTL).
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

  if (!code) {
    return { ok: false, httpStatus: 400, error: "missing_code", body: null }
  }
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      httpStatus: 500,
      error: "missing_app_credentials",
      body: { missing: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"].filter((k) =>
        k.includes("KEY") ? !clientId : !clientSecret
      ) },
    }
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  let res: Response
  try {
    res = await fetch(ALIEXPRESS_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    })
  } catch (err) {
    return {
      ok: false,
      httpStatus: 502,
      error: "network_error",
      body: { message: err instanceof Error ? err.message : String(err) },
    }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  const root = asRecord(json) ?? {}
  const nested =
    asRecord(root.token_result) ??
    asRecord(root.aliexpress_auth_token_create_response) ??
    asRecord(root.data) ??
    root

  const access_token = pickString(nested, ["access_token", "accessToken"])
  const refresh_token = pickString(nested, ["refresh_token", "refreshToken"])

  if (!res.ok || !access_token) {
    const errMsg =
      pickString(root, ["error_description", "error", "message", "msg"]) ||
      pickString(asRecord(root.error_response) ?? {}, ["msg", "sub_msg", "message"]) ||
      `http_${res.status}`
    return {
      ok: false,
      httpStatus: res.status || 400,
      error: errMsg,
      body: json,
    }
  }

  return {
    ok: true,
    tokens: {
      access_token,
      refresh_token,
      expires_in: pickNumber(nested, ["expires_in", "expire_time", "expiresIn"]),
      refresh_expires_in: pickNumber(nested, [
        "refresh_expires_in",
        "refresh_token_valid_time",
        "refreshExpiresIn",
      ]),
      user_id: pickString(nested, ["user_id", "userId"]) || null,
      seller_id: pickString(nested, ["seller_id", "sellerId"]) || null,
      account: pickString(nested, ["account", "user_nick", "seller_login_id"]) || null,
      raw: nested,
    },
  }
}

export function buildAliExpressAuthorizeUrl(appKey: string, redirectUri?: string): string {
  const uri = encodeURIComponent(redirectUri ?? resolveAliExpressOAuthRedirectUri())
  const clientId = encodeURIComponent(appKey.trim())
  return `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${uri}&client_id=${clientId}`
}
