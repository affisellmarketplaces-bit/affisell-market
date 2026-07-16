import "server-only"

import type { MarketplaceConnector, RadarConnectorProduct } from "@/lib/radar/connectors/types"
import { createRadarOAuthState } from "@/lib/radar/oauth-state"

export type AmazonLwaTokenResponse = {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

/** EU Selling Partner marketplace IDs (Catalog Items). */
export const AMAZON_EU_MARKETPLACE_IDS = [
  "A13V1IB3VIYZZH", // FR
  "A1PA6795UKMFR9", // DE
  "A1RKKUPIHCS9HS", // ES
  "APJ6JRA9NG5V4", // IT
  "A1F83G8C2ARO7P", // UK
] as const

function resolveAmazonRedirectUri(): string {
  const explicit = process.env.AMAZON_SP_API_REDIRECT_URI?.trim()
  if (explicit) return explicit
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  return new URL("/api/radar/amazon/callback", base).toString()
}

function resolveAmazonAuthUrl(): string {
  return (
    process.env.AMAZON_SP_API_AUTH_URL?.trim() ||
    "https://sellercentral.amazon.com/apps/authorize/consent"
  )
}

function resolveAmazonSpApiEndpoint(): string {
  return (
    process.env.AMAZON_SP_API_ENDPOINT?.trim() ||
    "https://sellingpartnerapi-eu.amazon.com"
  )
}

function lwaClientId(): string {
  return (
    process.env.AMAZON_LWA_CLIENT_ID?.trim() ||
    process.env.AMAZON_SP_API_CLIENT_ID?.trim() ||
    ""
  )
}

function lwaClientSecret(): string {
  return (
    process.env.AMAZON_LWA_CLIENT_SECRET?.trim() ||
    process.env.AMAZON_SP_API_CLIENT_SECRET?.trim() ||
    ""
  )
}

function applicationId(): string {
  return process.env.AMAZON_SP_API_APPLICATION_ID?.trim() || ""
}

export async function createAmazonOAuthState(userId: string): Promise<string> {
  return createRadarOAuthState(userId)
}

export function buildAmazonAuthorizeUrl(input: { state: string }): string {
  const appId = applicationId()
  const clientId = lwaClientId()
  if (!appId || !clientId) {
    throw new Error(
      "[radar] Amazon SP-API env missing (AMAZON_SP_API_APPLICATION_ID, AMAZON_LWA_CLIENT_ID)"
    )
  }

  const u = new URL(resolveAmazonAuthUrl())
  u.searchParams.set("application_id", appId)
  u.searchParams.set("state", input.state)
  u.searchParams.set("redirect_uri", resolveAmazonRedirectUri())
  u.searchParams.set("version", "beta")
  // Optional draft apps need version=beta; sandbox uses same consent host with draft app.
  return u.toString()
}

/** Exchange SP-API oauth code (LWA) for tokens. */
export async function exchangeAmazonCodeForToken(
  code: string
): Promise<AmazonLwaTokenResponse> {
  const clientId = lwaClientId()
  const clientSecret = lwaClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("[radar] Amazon LWA client env missing")
  }

  const body = new URLSearchParams()
  body.set("grant_type", "authorization_code")
  body.set("code", code)
  body.set("redirect_uri", resolveAmazonRedirectUri())
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  })
  return (await res.json().catch(() => ({}))) as AmazonLwaTokenResponse
}

export async function refreshAmazonAccessToken(
  refreshToken: string
): Promise<AmazonLwaTokenResponse> {
  const clientId = lwaClientId()
  const clientSecret = lwaClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("[radar] Amazon LWA client env missing")
  }

  const body = new URLSearchParams()
  body.set("grant_type", "refresh_token")
  body.set("refresh_token", refreshToken)
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  })
  return (await res.json().catch(() => ({}))) as AmazonLwaTokenResponse
}

type CatalogItem = {
  asin?: string
  summaries?: Array<{ itemName?: string; marketplaceId?: string }>
  images?: Array<{
    marketplaceId?: string
    images?: Array<{ link?: string; variant?: string }>
  }>
}

/**
 * SP-API Catalog Items 2022-04-01 search — EU marketplaceIds.
 * Header: x-amz-access-token (not Bearer).
 */
export async function getAmazonCatalogProducts(
  accessToken: string,
  opts?: { marketplaceIds?: string[]; keywords?: string }
): Promise<RadarConnectorProduct[]> {
  const marketplaceIds = opts?.marketplaceIds?.length
    ? opts.marketplaceIds
    : [...AMAZON_EU_MARKETPLACE_IDS]
  const keywords = opts?.keywords?.trim() || "electronics"
  const endpoint = resolveAmazonSpApiEndpoint().replace(/\/$/, "")
  const u = new URL(`${endpoint}/catalog/2022-04-01/items`)
  u.searchParams.set("marketplaceIds", marketplaceIds.join(","))
  u.searchParams.set("keywords", keywords)
  u.searchParams.set("pageSize", "10")
  u.searchParams.set("includedData", "summaries,images")

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: {
      "x-amz-access-token": accessToken,
      accept: "application/json",
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error("[radar/amazon]", {
      result: "catalog_error",
      status: res.status,
      body: body.slice(0, 200),
    })
    throw new Error(`Amazon Catalog Items failed (${res.status})`)
  }

  const json = (await res.json().catch(() => ({}))) as {
    items?: CatalogItem[]
  }
  const items = Array.isArray(json.items) ? json.items : []

  return items.map((item): RadarConnectorProduct => {
    const asin = String(item.asin ?? "").trim()
    const summary = item.summaries?.[0]
    const marketplaceId = summary?.marketplaceId ?? marketplaceIds[0] ?? "EU"
    const image =
      item.images?.[0]?.images?.find((i) => i.variant === "MAIN")?.link ||
      item.images?.[0]?.images?.[0]?.link
    return {
      id: asin || `unknown-${marketplaceId}`,
      title: summary?.itemName?.trim() || asin || "Amazon product",
      imageUrl: image,
      url: asin ? `https://www.amazon.fr/dp/${asin}` : undefined,
      marketplaceId,
    }
  })
}

export const amazonConnector: MarketplaceConnector = {
  id: "amazon",
  name: "Amazon",
  logo: "🅰️",
  category: "marketplace",
  region: "EU",
  authType: "sp_api",
  getAuthUrl(userId: string): string {
    return `/api/radar/amazon/start?userId=${encodeURIComponent(userId)}`
  },
  getProducts(accessToken, opts) {
    return getAmazonCatalogProducts(accessToken, opts)
  },
}
