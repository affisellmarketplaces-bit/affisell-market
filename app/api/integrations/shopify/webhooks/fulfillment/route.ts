import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { applyShopifyFulfillmentWebhook } from "@/lib/fulfillment/webhook-tracking"
import { prisma } from "@/lib/prisma"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"
import { verifyShopifyHmac } from "@/lib/supplier-sync/shopify/hmac"

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
    console.warn("[integrations/shopify/fulfillment]", { result: "invalid_hmac" })
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 })
  }

  const webhookId = req.headers.get("X-Shopify-Webhook-Id")?.trim()
  const topic = req.headers.get("X-Shopify-Topic")?.trim() ?? "unknown"
  const shopDomain = normalizeShopifyAdminHost(req.headers.get("X-Shopify-Shop-Domain") ?? "")

  let payload: Record<string, unknown>
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (webhookId) {
    const existing = await prisma.supplierWebhookEvent.findUnique({
      where: { shopifyWebhookId: webhookId },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ ok: true, action: "duplicate" })
    }
  }

  const integration = shopDomain
    ? await prisma.supplierIntegration.findFirst({
        where: { platform: "shopify", shopDomain, enabled: true },
        select: { id: true },
      })
    : null

  if (webhookId) {
    await prisma.supplierWebhookEvent.create({
      data: {
        shopifyWebhookId: webhookId,
        topic,
        shopDomain,
        integrationId: integration?.id ?? null,
        payload: payload as Prisma.InputJsonValue,
      },
    })
  }

  const out = await applyShopifyFulfillmentWebhook(payload)
  console.log("[integrations/shopify/fulfillment]", {
    shopDomain,
    topic,
    webhookId,
    ...out,
  })

  return NextResponse.json({ action: out.action, groupId: out.groupId })
}
