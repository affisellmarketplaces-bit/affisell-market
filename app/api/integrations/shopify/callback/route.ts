import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"
import {
  encryptShopifyAccessToken,
  integrationProviderShopify,
} from "@/lib/supplier-sync/shopify/credentials"
import { verifyShopifyOAuthQuery } from "@/lib/supplier-sync/shopify/hmac"
import {
  exchangeShopifyOAuthCode,
  parseShopifyOAuthState,
} from "@/lib/supplier-sync/shopify/oauth"
import { triggerShopifyFullSyncBackground } from "@/lib/supplier-sync/shopify/provider"
import { installShopifyWebhooks } from "@/lib/supplier-sync/shopify/webhooks-install"
import { setSupplierLiveSyncFlag } from "@/lib/supplier-sync/sync-engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function appBaseUrl(req: Request): string {
  return (
    process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(req.url).origin
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.SHOPIFY_API_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "SHOPIFY_API_SECRET not configured" }, { status: 503 })
  }

  if (!verifyShopifyOAuthQuery(url.searchParams, secret)) {
    return NextResponse.json({ error: "Invalid OAuth HMAC" }, { status: 401 })
  }

  const stateRaw = url.searchParams.get("state")
  const code = url.searchParams.get("code")
  const shop = normalizeShopifyAdminHost(url.searchParams.get("shop") ?? "")
  if (!stateRaw || !code || !shop) {
    return NextResponse.json({ error: "Missing code, shop, or state" }, { status: 400 })
  }

  const state = parseShopifyOAuthState(stateRaw)
  if (!state || state.shop !== shop) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 401 })
  }

  const tokenOut = await exchangeShopifyOAuthCode({ shop, code })
  if ("error" in tokenOut) {
    console.error("[integrations/shopify/callback]", {
      supplierId: state.userId,
      shop,
      result: "token_exchange_failed",
      error: tokenOut.error,
    })
    return NextResponse.redirect(
      `${appBaseUrl(req)}/dashboard/supplier/integrations?error=shopify_oauth`,
      302
    )
  }

  let accessTokenEncrypted: string
  try {
    accessTokenEncrypted = encryptShopifyAccessToken(tokenOut.accessToken)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encryption failed"
    return NextResponse.redirect(
      `${appBaseUrl(req)}/dashboard/supplier/integrations?error=encryption`,
      302
    )
  }

  const base = appBaseUrl(req)
  const config = { shop, apiVersion: "2024-10", oauth: true }

  const integration = await prisma.supplierIntegration.upsert({
    where: {
      userId_platform_name: {
        userId: state.userId,
        platform: "shopify",
        name: "main",
      },
    },
    create: {
      userId: state.userId,
      platform: "shopify",
      provider: integrationProviderShopify(),
      name: "main",
      shopDomain: shop,
      accessTokenEncrypted,
      scopes: tokenOut.scope,
      status: "CONNECTED",
      enabled: true,
      config,
    },
    update: {
      provider: integrationProviderShopify(),
      shopDomain: shop,
      accessTokenEncrypted,
      scopes: tokenOut.scope,
      status: "CONNECTED",
      enabled: true,
      errorMessage: null,
      lastSyncError: null,
      config,
    },
  })

  const creds = {
    shopHost: shop,
    accessToken: tokenOut.accessToken,
    apiVersion: "2024-10",
  }
  const wh = await installShopifyWebhooks({ creds, callbackBaseUrl: base })
  if (wh.webhookIds.length) {
    await prisma.supplierIntegration.update({
      where: { id: integration.id },
      data: { webhookId: wh.webhookIds.join(",") },
    })
  }
  if (wh.error) {
    await prisma.supplierIntegration.update({
      where: { id: integration.id },
      data: { errorMessage: wh.error, status: "ERROR" },
    })
  }

  await setSupplierLiveSyncFlag(state.userId, true)
  triggerShopifyFullSyncBackground(integration.id)

  console.log("[integrations/shopify/callback]", {
    supplierId: state.userId,
    shop,
    integrationId: integration.id,
    result: "connected",
  })

  return NextResponse.redirect(
    `${base}/dashboard/supplier/integrations?connected=shopify`,
    302
  )
}
