import { Injectable } from "@nestjs/common"
import { randomBytes } from "node:crypto"

import { RedisService } from "../../shared/redis"

type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  open_id?: string
  error?: string
  error_description?: string
}

@Injectable()
export class TiktokOAuthService {
  constructor(private readonly redis: RedisService) {}

  async createStateNonce(input: { clerkUserId: string }): Promise<string> {
    const state = randomBytes(24).toString("hex")
    await this.redis.raw.set(
      `tiktok:oauth:state:${state}`,
      JSON.stringify({ clerkUserId: input.clerkUserId }),
      "EX",
      10 * 60
    )
    return state
  }

  async consumeStateNonce(state: string): Promise<{ clerkUserId: string } | null> {
    const key = `tiktok:oauth:state:${state}`
    const ok = await this.redis.raw.get(key)
    if (!ok) return null
    await this.redis.raw.del(key)
    try {
      const parsed = JSON.parse(ok) as { clerkUserId?: unknown }
      if (typeof parsed.clerkUserId !== "string" || !parsed.clerkUserId.trim()) return null
      return { clerkUserId: parsed.clerkUserId }
    } catch {
      return null
    }
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

    // TikTok endpoints differ by product (Shop vs Open Platform). Keep this generic & overridable.
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
    return json
  }

  /**
   * TikTok Shop: fetch minimal shop info for persistence (id + name).
   * Endpoint can evolve; override with `TIKTOK_SHOP_INFO_URL` if needed.
   */
  async getShopInfo(accessToken: string): Promise<{ shopId: string; shopName: string }> {
    const url =
      process.env.TIKTOK_SHOP_INFO_URL?.trim() ||
      "https://open-api.tiktokglobalshop.com/api/shop/get_authorized_shop"

    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const json = (await res.json().catch(() => ({}))) as any

    // Best-effort parsing — auditors can adjust mapping once real payload is known.
    const shopId = String(json?.data?.shop_id || json?.data?.shopId || json?.shop_id || "").trim()
    const shopName = String(json?.data?.shop_name || json?.data?.shopName || json?.shop_name || "")
      .trim()
    if (!shopId) throw new Error("TikTok shop info missing shop_id")
    return { shopId, shopName: shopName || "TikTok Shop" }
  }
}

