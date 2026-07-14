import { ForbiddenException, Injectable } from "@nestjs/common"
import { randomBytes } from "node:crypto"

import { RedisService } from "../../shared/redis"

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

/** TikTok Shop OAuth scopes — P0. */
export const TIKTOK_SHOP_SCOPES =
  "user.info.basic,video.list,tiktok.shop.v2:product:list,tiktok.shop.v2:order:list,tiktok.shop.v2:analytics:view,tiktok.shop.v2:shop:info"

@Injectable()
export class TiktokOAuthService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Binds OAuth state to Clerk userId:
   * state = `${nonce}.${userId}` stored in Redis for 10 min.
   */
  async createOAuthState(clerkUserId: string): Promise<string> {
    const nonce = randomBytes(16).toString("hex")
    const state = `${nonce}.${clerkUserId}`
    await this.redis.raw.setex(`tiktok:state:${state}`, TIKTOK_OAUTH_STATE_TTL_SEC, clerkUserId)
    return state
  }

  /**
   * Validates state nonce + Redis binding, then deletes key (single-use).
   */
  async verifyOAuthState(state: string): Promise<string> {
    const dot = state.indexOf(".")
    if (dot <= 0 || dot >= state.length - 1) {
      throw new ForbiddenException("Invalid OAuth state format")
    }

    const userIdFromState = state.slice(dot + 1).trim()
    if (!userIdFromState) {
      throw new ForbiddenException("Invalid OAuth state user")
    }

    const key = `tiktok:state:${state}`
    const storedUserId = await this.redis.raw.get(key)
    if (!storedUserId || storedUserId !== userIdFromState) {
      throw new ForbiddenException("Invalid or expired OAuth state")
    }

    await this.redis.raw.del(key)
    return storedUserId
  }

  buildAuthorizeUrl(input: { state: string; scope: string }): string {
    const authUrl = process.env.TIKTOK_AUTH_URL!
    const redirectUri = process.env.TIKTOK_REDIRECT_URI!
    const clientKey = process.env.TIKTOK_CLIENT_KEY!

    const u = new URL(authUrl)
    u.searchParams.set("client_key", clientKey)
    u.searchParams.set("redirect_uri", redirectUri)
    u.searchParams.set("response_type", "code")
    u.searchParams.set("state", input.state)
    u.searchParams.set("scope", input.scope)
    return u.toString()
  }

  async exchangeCodeForToken(code: string): Promise<TikTokTokenResponse> {
    const tokenUrl = process.env.TIKTOK_TOKEN_URL!
    const redirectUri = process.env.TIKTOK_REDIRECT_URI!
    const clientKey = process.env.TIKTOK_CLIENT_KEY!
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!

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

  /** TikTok Shop: fetch shop id + name for ShopConnection upsert. */
  async getShopInfo(accessToken: string): Promise<{ shopId: string; shopName: string }> {
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
