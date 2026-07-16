import "server-only"

import type { GoogleConnector, RadarConnectorProduct } from "@/lib/radar/connectors/types"
import { createRadarOAuthState } from "@/lib/radar/oauth-state"

export const GOOGLE_MERCHANT_SCOPE = "https://www.googleapis.com/auth/content"

export type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() || ""
}

function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || ""
}

export function resolveGoogleMerchantRedirectUri(): string {
  const explicit = process.env.GOOGLE_MERCHANT_REDIRECT_URI?.trim()
  if (explicit) return explicit
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  return new URL("/api/radar/google/merchant/callback", base).toString()
}

export async function createGoogleMerchantOAuthState(userId: string): Promise<string> {
  return createRadarOAuthState(userId)
}

export function buildGoogleMerchantAuthorizeUrl(input: { state: string }): string {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error("[radar] GOOGLE_CLIENT_ID missing for Merchant OAuth")
  }

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  u.searchParams.set("client_id", clientId)
  u.searchParams.set("redirect_uri", resolveGoogleMerchantRedirectUri())
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", GOOGLE_MERCHANT_SCOPE)
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", "consent")
  u.searchParams.set("state", input.state)
  return u.toString()
}

export async function exchangeGoogleCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("[radar] Google OAuth client env missing")
  }

  const body = new URLSearchParams()
  body.set("code", code)
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)
  body.set("redirect_uri", resolveGoogleMerchantRedirectUri())
  body.set("grant_type", "authorization_code")

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  return (await res.json().catch(() => ({}))) as GoogleTokenResponse
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("[radar] Google OAuth client env missing")
  }

  const body = new URLSearchParams()
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)
  body.set("refresh_token", refreshToken)
  body.set("grant_type", "refresh_token")

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  return (await res.json().catch(() => ({}))) as GoogleTokenResponse
}

type MerchantProduct = {
  id?: string
  offerId?: string
  title?: string
  price?: { value?: string; currency?: string }
  imageLink?: string
  link?: string
}

/**
 * Content API for Shopping — list products for a merchant.
 * GET https://shoppingcontent.googleapis.com/content/v2.1/{merchantId}/products
 */
export async function getGoogleMerchantProducts(
  accessToken: string,
  opts: { merchantId: string }
): Promise<RadarConnectorProduct[]> {
  const merchantId = opts.merchantId.trim()
  if (!merchantId) throw new Error("merchantId required")

  const u = new URL(
    `https://shoppingcontent.googleapis.com/content/v2.1/${encodeURIComponent(merchantId)}/products`
  )
  u.searchParams.set("maxResults", "50")

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error("[radar/google-merchant]", {
      result: "products_error",
      status: res.status,
      body: body.slice(0, 200),
    })
    throw new Error(`Google Merchant products failed (${res.status})`)
  }

  const json = (await res.json().catch(() => ({}))) as { resources?: MerchantProduct[] }
  const resources = Array.isArray(json.resources) ? json.resources : []

  return resources.map((p): RadarConnectorProduct => {
    const priceVal = p.price?.value ? Number(p.price.value) : undefined
    return {
      id: String(p.offerId ?? p.id ?? "").trim() || "unknown",
      title: p.title?.trim() || "Merchant product",
      price: Number.isFinite(priceVal) ? priceVal : undefined,
      currency: p.price?.currency,
      imageUrl: p.imageLink,
      url: p.link,
      marketplaceId: "google_merchant",
    }
  })
}

/** List merchant accounts accessible with the token (to resolve merchantId). */
export async function listGoogleMerchantAccounts(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error("[radar/google-merchant]", {
      result: "authinfo_error",
      status: res.status,
      body: body.slice(0, 200),
    })
    throw new Error(`Google Merchant authinfo failed (${res.status})`)
  }

  const json = (await res.json().catch(() => ({}))) as {
    accountIdentifiers?: Array<{ merchantId?: string; aggregatorId?: string }>
  }
  const ids = Array.isArray(json.accountIdentifiers) ? json.accountIdentifiers : []
  return ids
    .map((a) => {
      const id = String(a.merchantId ?? a.aggregatorId ?? "").trim()
      return id ? { id, name: `Merchant ${id}` } : null
    })
    .filter((x): x is { id: string; name: string } => x != null)
}

export const googleMerchantConnector: GoogleConnector = {
  id: "google_merchant",
  name: "Google Merchant Center",
  logo: "🛒",
  category: "google",
  region: "GLOBAL",
  authType: "oauth",
  scopes: [GOOGLE_MERCHANT_SCOPE],
  getAuthUrl(userId: string): string {
    return `/api/radar/google/merchant/start?userId=${encodeURIComponent(userId)}`
  },
  getProducts(accessToken, opts) {
    const merchantId = opts?.merchantId?.trim()
    if (!merchantId) return Promise.reject(new Error("merchantId required"))
    return getGoogleMerchantProducts(accessToken, { merchantId })
  },
}
