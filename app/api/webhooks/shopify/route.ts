import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"
import { verifyShopifyHmac } from "@/lib/supplier-sync/shopify/hmac"
import { ShopifyProvider } from "@/lib/supplier-sync/shopify/provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_API_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const rawBody = await req.text()
  const hmac = req.headers.get("X-Shopify-Hmac-Sha256")
  if (!verifyShopifyHmac({ secret, rawBody, hmacHeader: hmac })) {
    console.warn("[webhooks/shopify]", { result: "invalid_hmac" })
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 })
  }

  const webhookId = req.headers.get("X-Shopify-Webhook-Id")?.trim()
  const topic = req.headers.get("X-Shopify-Topic")?.trim() ?? "unknown"
  const shopDomain = normalizeShopifyAdminHost(req.headers.get("X-Shopify-Shop-Domain") ?? "")
  if (!webhookId || !shopDomain) {
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const integration = await prisma.supplierIntegration.findFirst({
    where: {
      platform: "shopify",
      shopDomain,
      enabled: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!integration) {
    console.warn("[webhooks/shopify]", { shopDomain, topic, result: "integration_not_found" })
    return NextResponse.json({ ok: true, action: "ignored" })
  }

  const provider = new ShopifyProvider()
  const out = await provider.handleWebhook({
    integration,
    topic,
    shopDomain,
    payload,
    webhookId,
  })

  console.log("[webhooks/shopify]", {
    shopDomain,
    topic,
    webhookId,
    integrationId: integration.id,
    ...out,
  })

  if (!out.ok) {
    return NextResponse.json({ error: out.error ?? "handler_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: out.action })
}
