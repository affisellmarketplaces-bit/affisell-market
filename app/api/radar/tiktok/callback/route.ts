import { NextResponse } from "next/server"

import { encryptString } from "@/lib/crypto"
import { getMiDb } from "@/lib/prisma-mi"
import { assertRadarApiEnabled } from "@/lib/radar/gate"
import {
  exchangeCodeForToken,
  getTikTokShopInfo,
  verifyTikTokOAuthState,
} from "@/lib/radar/tiktok-oauth"

function parseScopes(scope: string | undefined): string[] {
  if (!scope?.trim()) return []
  return scope
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(req: Request) {
  const blocked = assertRadarApiEnabled()
  if (blocked) return blocked

  const url = new URL(req.url)
  const code = url.searchParams.get("code")?.trim()
  const state = url.searchParams.get("state")?.trim()
  const oauthError = url.searchParams.get("error")?.trim()

  if (oauthError) {
    console.log("[radar/tiktok/callback]", { result: "oauth_error", oauthError })
    return NextResponse.redirect(new URL(`/radar/connect?error=${encodeURIComponent(oauthError)}`, req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/radar/connect?error=missing_code", req.url))
  }

  try {
    const userId = await verifyTikTokOAuthState(state)
    const token = await exchangeCodeForToken(code)

    if (token.error || !token.access_token || !token.refresh_token) {
      console.error("[radar/tiktok/callback]", {
        userId,
        result: "token_error",
        error: token.error,
        description: token.error_description,
      })
      return NextResponse.redirect(new URL("/radar/connect?error=token_exchange", req.url))
    }

    const { shopId, shopName } = await getTikTokShopInfo(token.access_token)
    const expiresIn =
      typeof token.expires_in === "number" && token.expires_in > 0 ? token.expires_in : 86400
    const expiresAt = new Date(Date.now() + expiresIn * 1000)
    const scopes = parseScopes(token.scope)

    await getMiDb().shopConnection.upsert({
      where: { userId },
      create: {
        userId,
        shopId,
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        scopes,
      },
      update: {
        shopId,
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        scopes,
      },
    })

    console.log("[radar/tiktok/callback]", { userId, shopId, result: "connected" })
    return NextResponse.redirect(new URL("/radar?connected=1", req.url))
  } catch (err) {
    console.error("[radar/tiktok/callback]", {
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=callback", req.url))
  }
}
