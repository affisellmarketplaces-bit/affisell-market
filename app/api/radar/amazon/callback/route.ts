import { NextResponse } from "next/server"

import { encryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import {
  exchangeAmazonCodeForToken,
} from "@/lib/radar/connectors/amazon"
import { gate } from "@/lib/radar/gate"
import { verifyRadarOAuthState } from "@/lib/radar/oauth-state"

export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const url = new URL(req.url)
  const code =
    url.searchParams.get("spapi_oauth_code")?.trim() ||
    url.searchParams.get("code")?.trim()
  const state = url.searchParams.get("state")?.trim()
  const sellingPartnerId =
    url.searchParams.get("selling_partner_id")?.trim() ||
    url.searchParams.get("sellingPartnerId")?.trim() ||
    ""
  const oauthError = url.searchParams.get("error")?.trim()

  if (oauthError) {
    console.log("[radar/amazon/callback]", { result: "oauth_error", oauthError })
    return NextResponse.redirect(
      new URL(`/radar/connect?error=${encodeURIComponent(oauthError)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/radar/connect?error=missing_code", req.url))
  }

  try {
    const userId = await verifyRadarOAuthState(state)
    const token = await exchangeAmazonCodeForToken(code)

    if (token.error || !token.access_token || !token.refresh_token) {
      console.error("[radar/amazon/callback]", {
        userId,
        result: "token_error",
        error: token.error,
        description: token.error_description,
      })
      return NextResponse.redirect(new URL("/radar/connect?error=token_exchange", req.url))
    }

    const shopId = sellingPartnerId || `amazon-${userId.slice(0, 8)}`
    const shopName = sellingPartnerId
      ? `Amazon Seller ${sellingPartnerId}`
      : "Amazon Seller Central"
    const expiresIn =
      typeof token.expires_in === "number" && token.expires_in > 0 ? token.expires_in : 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000)
    const connectorId = "amazon"

    await getRadarDb().shopConnection.upsert({
      where: {
        userId_connectorId_shopId: { userId, connectorId, shopId },
      },
      create: {
        userId,
        connectorId,
        category: "marketplace",
        region: "EU",
        shopId,
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        scopes: [],
        status: "active",
        marketplaceMeta: { sellingPartnerId: sellingPartnerId || null },
      },
      update: {
        shopName,
        accessToken: encryptString(token.access_token),
        refreshToken: encryptString(token.refresh_token),
        expiresAt,
        status: "active",
        marketplaceMeta: { sellingPartnerId: sellingPartnerId || null },
      },
    })

    console.log("[radar/amazon/callback]", { userId, shopId, result: "connected" })
    return NextResponse.redirect(new URL("/radar?connected=1&source=amazon", req.url))
  } catch (err) {
    console.error("[radar/amazon/callback]", {
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=callback", req.url))
  }
}
