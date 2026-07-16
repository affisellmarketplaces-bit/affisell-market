import "server-only"

import { randomBytes } from "node:crypto"

import { getRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"
import type { MarketplaceConnector } from "@/lib/radar/connectors/types"

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

const TIKTOK_OAUTH_STATE_TTL_SEC = 600

export const TIKTOK_SHOP_SCOPES =
  "user.info.basic,video.list,tiktok.shop.v2:product:list,tiktok.shop.v2:order:list,tiktok.shop.v2:analytics:view,tiktok.shop.v2:shop:info"

const memoryStates = new Map<string, { userId: string; expiresAt: number }>()

function pruneMemoryStates(): void {
  const now = Date.now()
  for (const [k, v] of memoryStates) {
    if (v.expiresAt < now) memoryStates.delete(k)
  }
}

/** Binds OAuth state to Affisell userId: `${nonce}.${userId}`. */
export async function createTikTokOAuthState(userId: string): Promise<string> {
  const nonce = randomBytes(16).toString("hex")
  const state = `${nonce}.${userId}`
  const key = `tiktok:state:${state}`

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    await redis.setex(key, TIKTOK_OAUTH_STATE_TTL_SEC, userId)
  } else {
    pruneMemoryStates()
    memoryStates.set(key, {
      userId,
      expiresAt: Date.now() + TIKTOK_OAUTH_STATE_TTL_SEC * 1000,
    })
  }

  return state
}

/** Validates state + Redis/memory binding, then deletes key (single-use). */
export async function verifyTikTokOAuthState(state: string): Promise<string> {
  const dot = state.indexOf(".")
  if (dot <= 0 || dot >= state.length - 1) {
    throw new Error("Invalid OAuth state format")
  }

  const userIdFromState = state.slice(dot + 1).trim()
  if (!userIdFromState) throw new Error("Invalid OAuth state user")

  const key = `tiktok:state:${state}`

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    const storedUserId = await redis.get(key)
    if (!storedUserId || storedUserId !== userIdFromState) {
      throw new Error("Invalid or expired OAuth state")
    }
    await redis.del(key)
    return storedUserId
  }

  const entry = memoryStates.get(key)
  memoryStates.delete(key)
  if (!entry || entry.expiresAt < Date.now() || entry.userId !== userIdFromState) {
    throw new Error("Invalid or expired OAuth state")
  }

  return entry.userId
}

export function resolveTikTokRedirectUri(): string {
  const explicit = process.env.TIKTOK_REDIRECT_URI?.trim()
  if (explicit) return explicit
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  return new URL("/api/radar/tiktok/callback", base).toString()
}

export function buildTikTokAuthorizeUrl(input: { state: string; scope: string }): string {
  const authUrl = process.env.TIKTOK_AUTH_URL?.trim()
  const redirectUri = resolveTikTokRedirectUri()
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim()
  if (!authUrl || !clientKey) {
    throw new Error("[radar] TikTok OAuth env missing (TIKTOK_AUTH_URL, TIKTOK_CLIENT_KEY)")
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
  const tokenUrl =
    process.env.TIKTOK_TOKEN_URL?.trim() || "https://auth.tiktok-shops.com/api/v2/token/get"
  const redirectUri = resolveTikTokRedirectUri()
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim()
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim()
  if (!clientKey || !clientSecret) {
    throw new Error("[radar] TikTok token env missing")
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
  return (await res.json().catch(() => ({}))) as TikTokTokenResponse
}

export async function getTikTokShopInfo(
  accessToken: string
): Promise<{ shopId: string; shopName: string }> {
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
