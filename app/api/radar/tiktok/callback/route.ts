import { NextResponse } from "next/server"

import { encryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import {
  exchangeCodeForToken,
  getTikTokShopInfo,
  verifyTikTokOAuthState,
} from "@/lib/radar/connectors/tiktok-shop"
import { gate } from "@/lib/radar/gate"

function parseScopes(scope: string | undefined): string[] {
  if (!scope?.trim()) return []
  return scope
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * TikTok Shop OAuth callback — Partner Center URI:
 * https://affisell.com/api/intelli/tiktok/callback
 * (also available at /api/radar/tiktok/callback)
 */
export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const url = new URL(req.url)
  const code =
    url.searchParams.get("code")?.trim() ||
    url.searchParams.get("auth_code")?.trim()
  const state = url.searchParams.get("state")?.trim()
  const oauthError = url.searchParams.get("error")?.trim()

  if (oauthError) {
    console.log("[radar/tiktok/callback]", { result: "oauth_error", oauthError })
    return NextResponse.redirect(
      new URL(`/radar/connect?error=${encodeURIComponent(oauthError)}`, req.url)
    )
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
    const connectorId = "tiktok_shop"

    await getRadarDb().shopConnection.upsert({
      where: {
        userId_connectorId_shopId: { userId, connectorId, shopId },
      },
      create: {
        userId,
        connectorId,
        category: "marketplace",
        region: "GLOBAL",
        shopId,
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        scopes,
        status: "active",
        marketplaceMeta: {
          openId: token.open_id ?? null,
          source: "affisell_analytics_connector",
        },
      },
      update: {
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        scopes,
        status: "active",
        marketplaceMeta: {
          openId: token.open_id ?? null,
          source: "affisell_analytics_connector",
        },
      },
    })

    console.log("[radar/tiktok/callback]", { userId, shopId, result: "connected" })
    return NextResponse.redirect(
      new URL(
        `/radar?connected=1&success=tiktok_connected&shop_id=${encodeURIComponent(shopId)}`,
        req.url
      )
    )
  } catch (err) {
    console.error("[radar/tiktok/callback]", {
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=callback", req.url))
  }
}
