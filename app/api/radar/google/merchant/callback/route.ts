import { NextResponse } from "next/server"

import { encryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import {
  GOOGLE_MERCHANT_SCOPE,
  exchangeGoogleCodeForToken,
  listGoogleMerchantAccounts,
} from "@/lib/radar/connectors/google-merchant"
import { gate } from "@/lib/radar/gate"
import { verifyRadarOAuthState } from "@/lib/radar/oauth-state"

export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const url = new URL(req.url)
  const code = url.searchParams.get("code")?.trim()
  const state = url.searchParams.get("state")?.trim()
  const oauthError = url.searchParams.get("error")?.trim()

  if (oauthError) {
    console.log("[radar/google/merchant/callback]", { result: "oauth_error", oauthError })
    return NextResponse.redirect(
      new URL(`/radar/connect?error=${encodeURIComponent(oauthError)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/radar/connect?error=missing_code", req.url))
  }

  try {
    const userId = await verifyRadarOAuthState(state)
    const token = await exchangeGoogleCodeForToken(code)

    if (token.error || !token.access_token) {
      console.error("[radar/google/merchant/callback]", {
        userId,
        result: "token_error",
        error: token.error,
        description: token.error_description,
      })
      return NextResponse.redirect(new URL("/radar/connect?error=token_exchange", req.url))
    }

    const accounts = await listGoogleMerchantAccounts(token.access_token).catch((err) => {
      console.warn("[radar/google/merchant/callback]", {
        userId,
        result: "authinfo_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
      return [] as Array<{ id: string; name: string }>
    })

    const merchantId =
      accounts[0]?.id ||
      process.env.GOOGLE_MERCHANT_ID?.trim() ||
      `gmc-${userId.slice(0, 8)}`
    const shopName = accounts[0]?.name || `Google Merchant ${merchantId}`
    const expiresIn =
      typeof token.expires_in === "number" && token.expires_in > 0 ? token.expires_in : 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000)
    const connectorId = "google_merchant"

    await getRadarDb().shopConnection.upsert({
      where: {
        userId_connectorId_shopId: { userId, connectorId, shopId: merchantId },
      },
      create: {
        userId,
        connectorId,
        category: "google",
        region: "GLOBAL",
        shopId: merchantId,
        shopName,
        merchantId,
        accessToken: encryptString(token.access_token),
        refreshToken: token.refresh_token ? encryptString(token.refresh_token) : null,
        expiresAt,
        scopes: [GOOGLE_MERCHANT_SCOPE],
        status: "active",
      },
      update: {
        shopName,
        merchantId,
        accessToken: encryptString(token.access_token),
        ...(token.refresh_token
          ? { refreshToken: encryptString(token.refresh_token) }
          : {}),
        expiresAt,
        scopes: [GOOGLE_MERCHANT_SCOPE],
        status: "active",
      },
    })

    console.log("[radar/google/merchant/callback]", {
      userId,
      merchantId,
      result: "connected",
    })
    return NextResponse.redirect(new URL("/radar?connected=1&source=google_merchant", req.url))
  } catch (err) {
    console.error("[radar/google/merchant/callback]", {
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=callback", req.url))
  }
}
