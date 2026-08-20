import { createHmac, timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { applyWooFulfillmentWebhook } from "@/lib/fulfillment/webhook-tracking"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function verifyWooSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.trim()) return false
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature.trim()))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const topic = req.headers.get("X-WC-Webhook-Topic")?.trim() ?? "unknown"
  const webhookId = req.headers.get("X-WC-Webhook-Delivery-Id")?.trim()
  const source = req.headers.get("X-WC-Webhook-Source")?.trim() ?? ""

  let payload: Record<string, unknown>
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const integration = source
    ? await prisma.supplierIntegration.findFirst({
        where: {
          provider: "WOOCOMMERCE",
          shopDomain: { contains: source.replace(/^https?:\/\//, "").split("/")[0] },
          enabled: true,
        },
        select: { id: true, config: true },
      })
    : null

  const config =
    integration?.config && typeof integration.config === "object" && !Array.isArray(integration.config)
      ? (integration.config as Record<string, unknown>)
      : {}
  const webhookSecret =
    typeof config.webhookSecret === "string" ? config.webhookSecret.trim() : ""
  const globalSecret = process.env.WOO_WEBHOOK_SECRET?.trim() ?? ""
  const secret = webhookSecret || globalSecret

  if (secret) {
    const sig = req.headers.get("X-WC-Webhook-Signature")
    if (!verifyWooSignature(rawBody, sig, secret)) {
      console.warn("[integrations/woo/fulfillment]", { result: "invalid_signature", topic })
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  const externalOrderId =
    payload.id != null ? String(payload.id) : payload.order_id != null ? String(payload.order_id) : null

  if (!externalOrderId) {
    return NextResponse.json({ ok: true, action: "ignored_no_order_id" })
  }

  const out = await applyWooFulfillmentWebhook(
    {
      id: payload.id as number | string | undefined,
      tracking_number: payload.tracking_number as string | null | undefined,
      tracking_provider: payload.tracking_provider as string | null | undefined,
      tracking_link: payload.tracking_link as string | null | undefined,
    },
    externalOrderId
  )

  console.log("[integrations/woo/fulfillment]", {
    topic,
    webhookId,
    source,
    externalOrderId,
    ...out,
  })

  return NextResponse.json({ action: out.action, groupId: out.groupId })
}
