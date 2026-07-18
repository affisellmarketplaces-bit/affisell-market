import "server-only"

import { randomBytes } from "node:crypto"

import { getRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"
import type { MarketplaceConnector } from "@/lib/radar/connectors/types"
import { isRadarEnabled, requireRedis } from "@/lib/radar/gate"
import { tiktokRedirectUri } from "@/lib/tiktok/env"

export type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  open_id?: string
  error?: string
  error_description?: string
}

type OAuthStatePayload = { userId: string; nonce: string }

const TIKTOK_OAUTH_STATE_TTL_SEC = 600

export const TIKTOK_SHOP_SCOPES =
  "user.info.basic,video.list,tiktok.shop.v2:product:list,tiktok.shop.v2:order:list,tiktok.shop.v2:analytics:view,tiktok.shop.v2:shop:info"

/** Dev-only fallback when Radar is off and REDIS_URL is absent. Never used when RADAR_ENABLED=true. */
const memoryStates = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>()

function oauthStateKey(state: string): string {
  return `radar:oauth:state:${state}`
}

function pruneMemoryStates(): void {
  const now = Date.now()
  for (const [k, v] of memoryStates) {
    if (v.expiresAt < now) memoryStates.delete(k)
  }
}

function parseStateUserId(state: string): string {
  const dot = state.indexOf(".")
  if (dot <= 0 || dot >= state.length - 1) {
    throw new Error("Invalid OAuth state format")
  }
  const userIdFromState = state.slice(dot + 1).trim()
  if (!userIdFromState) throw new Error("Invalid OAuth state user")
  return userIdFromState
}

/** Binds OAuth state to Affisell userId: `${nonce}.${userId}`. Redis required when Radar is enabled. */
export async function createTikTokOAuthState(userId: string): Promise<string> {
  requireRedis()

  const nonce = randomBytes(16).toString("hex")
  const state = `${nonce}.${userId}`
  const key = oauthStateKey(state)
  const payload: OAuthStatePayload = { userId, nonce }

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    await redis.setex(key, TIKTOK_OAUTH_STATE_TTL_SEC, JSON.stringify(payload))
    return state
  }

  // RADAR_ENABLED=false + no REDIS_URL (local): in-memory only
  console.warn(
    "[radar/oauth] REDIS_URL missing — using in-memory OAuth state (dev only; multi-instance unsafe)"
  )
  pruneMemoryStates()
  memoryStates.set(key, {
    payload,
    expiresAt: Date.now() + TIKTOK_OAUTH_STATE_TTL_SEC * 1000,
  })

  return state
}

/** Validates state + Redis/memory binding, then deletes key (single-use). */
export async function verifyTikTokOAuthState(state: string): Promise<string> {
  requireRedis()

  const userIdFromState = parseStateUserId(state)
  const key = oauthStateKey(state)

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    const raw = await redis.get(key)
    await redis.del(key)
    if (!raw) throw new Error("Invalid or expired OAuth state")

    let stateData: OAuthStatePayload
    try {
      stateData = JSON.parse(raw) as OAuthStatePayload
    } catch {
      throw new Error("Invalid OAuth state payload")
    }

    if (!stateData.userId || stateData.userId !== userIdFromState) {
      throw new Error("State user mismatch")
    }
    return stateData.userId
  }

  if (isRadarEnabled()) {
    // requireRedis should have thrown already; belt-and-suspenders
    throw new Error("REDIS_URL required when RADAR_ENABLED=true")
  }

  const entry = memoryStates.get(key)
  memoryStates.delete(key)
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error("Invalid or expired OAuth state")
  }
  if (entry.payload.userId !== userIdFromState) {
    throw new Error("State user mismatch")
  }

  return entry.payload.userId
}

export function resolveTikTokRedirectUri(): string {
  return tiktokRedirectUri()
}

export function buildTikTokAuthorizeUrl(input: { state: string; scope: string }): string {
  // Prefer Partner Center service authorize (App ID / service_id)
  const serviceId =
    process.env.TIKTOK_SHOP_APP_ID?.trim() ||
    process.env.TIKTOK_SHOP_SERVICE_ID?.trim() ||
    ""
  const partnerAuth =
    process.env.TIKTOK_SHOP_AUTH_URL?.trim() ||
    "https://services.tiktokshop.com/open/authorize"

  if (serviceId) {
    const u = new URL(partnerAuth)
    u.searchParams.set("service_id", serviceId)
    u.searchParams.set("state", input.state)
    return u.toString()
  }

  const authUrl = process.env.TIKTOK_AUTH_URL?.trim()
  const redirectUri = resolveTikTokRedirectUri()
  const clientKey =
    process.env.TIKTOK_SHOP_APP_KEY?.trim() || process.env.TIKTOK_CLIENT_KEY?.trim()
  if (!authUrl || !clientKey) {
    throw new Error(
      "[radar] TikTok OAuth env missing (TIKTOK_SHOP_APP_ID or TIKTOK_AUTH_URL+TIKTOK_CLIENT_KEY)"
    )
  }

  const u = new URL(authUrl)
  u.searchParams.set("client_key", clientKey)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("state", input.state)
  u.searchParams.set("scope", input.scope)
  return u.toString()
}

export async function exchangeCodeForToken(code: string): Promise<TikTokTokenResponse> {
  try {
    const { exchangeAuthCode } = await import("@/lib/tiktok/client")
    const token = await exchangeAuthCode(code)
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in,
      open_id: token.open_id,
      scope: token.scope,
    }
  } catch (primaryErr) {
    // Legacy form-urlencoded fallback
    const tokenUrl =
      process.env.TIKTOK_TOKEN_URL?.trim() || "https://auth.tiktok-shops.com/api/v2/token/get"
    const redirectUri = resolveTikTokRedirectUri()
    const clientKey =
      process.env.TIKTOK_SHOP_APP_KEY?.trim() || process.env.TIKTOK_CLIENT_KEY?.trim()
    const clientSecret =
      process.env.TIKTOK_SHOP_APP_SECRET?.trim() || process.env.TIKTOK_CLIENT_SECRET?.trim()
    if (!clientKey || !clientSecret) {
      throw primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr))
    }

    const body = new URLSearchParams()
    body.set("client_key", clientKey)
    body.set("client_secret", clientSecret)
    body.set("code", code)
    body.set("grant_type", "authorization_code")
    body.set("redirect_uri", redirectUri)

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
    const json = (await res.json().catch(() => ({}))) as TikTokTokenResponse
    if (json.access_token) return json
    throw primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr))
  }
}

export async function getTikTokShopInfo(
  accessToken: string
): Promise<{ shopId: string; shopName: string }> {
  try {
    const { getShopInfo } = await import("@/lib/tiktok/client")
    const info = await getShopInfo(accessToken)
    return { shopId: info.shopId, shopName: info.shopName }
  } catch {
    const url =
      process.env.TIKTOK_SHOP_INFO_URL?.trim() ||
      "https://open-api.tiktokglobalshop.com/api/shop/get_authorized_shop"

    const res = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

    const data = (json.data as Record<string, unknown> | undefined) ?? json
    const shopId = String(data.shop_id ?? data.shopId ?? "").trim()
    const shopName = String(data.shop_name ?? data.shopName ?? "").trim()
    if (!shopId) throw new Error("TikTok shop info missing shop_id")
    return { shopId, shopName: shopName || "TikTok Shop" }
  }
}

export const tiktokShopConnector: MarketplaceConnector = {
  id: "tiktok_shop",
  name: "TikTok Shop",
  logo: "🛍️",
  category: "marketplace",
  region: "GLOBAL",
  authType: "oauth",
  scopes: TIKTOK_SHOP_SCOPES.split(","),
  getAuthUrl(userId: string): string {
    return `/api/radar/tiktok/start?userId=${encodeURIComponent(userId)}`
  },
}
