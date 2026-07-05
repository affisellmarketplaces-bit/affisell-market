import { createHmac, timingSafeEqual } from "node:crypto"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { notifyOrderDelivered } from "@/lib/emails/notify-order-delivered"
import { webhookSecretGate } from "@/lib/require-production-secret"
import { triggerLightningPayout } from "@/lib/stripe-lightning"
import { prisma } from "@/lib/prisma"
import { recordOrderTrackingEvent } from "@/lib/order-tracking-event"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const afterShipWebhookSchema = z
  .object({
    event: z.string().optional(),
    msg: z
      .object({
        tag: z.string().optional(),
        tracking_number: z.string().optional(),
        slug: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

function afterShipWebhookSecret(): string | null {
  return (
    process.env.AFTERSHIP_WEBHOOK_SECRET?.trim() ||
    process.env.AFTIRSHIP_WEBHOOK_SECRET?.trim() ||
    null
  )
}

function verifyAfterShipSignature(
  rawBody: string,
  signature: string | null
): boolean | "missing_prod" {
  const secret = afterShipWebhookSecret()
  const gate = webhookSecretGate(secret)
  if (gate === "missing_prod") return "missing_prod"
  if (gate === "missing_sig") return true
  if (!secret || !signature) return false

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function normalizeTag(tag: string | undefined): string {
  return tag?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? ""
}

function isDeliveredTag(tag: string): boolean {
  return tag === "delivered"
}

function isInTransitTag(tag: string): boolean {
  return (
    tag === "intransit" ||
    tag === "in_transit" ||
    tag === "outfordelivery" ||
    tag === "out_for_delivery" ||
    tag === "availableforpickup" ||
    tag === "available_for_pickup"
  )
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature =
    req.headers.get("aftership-hmac-sha256") ??
    req.headers.get("x-aftership-hmac-sha256") ??
    req.headers.get("as-signature")

  const sigCheck = verifyAfterShipSignature(rawBody, signature)
  if (sigCheck === "missing_prod") {
    return NextResponse.json({ error: "webhook_secret_not_configured" }, { status: 503 })
  }
  if (!sigCheck) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = afterShipWebhookSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const tag = normalizeTag(parsed.data.msg?.tag)
  const trackingNumber = parsed.data.msg?.tracking_number?.trim()

  if (!trackingNumber) {
    return NextResponse.json({ error: "missing_tracking_number" }, { status: 400 })
  }

  if (!isDeliveredTag(tag) && !isInTransitTag(tag)) {
    return NextResponse.json({ ok: true, skipped: "tag_ignored", tag })
  }

  const order = await prisma.order.findFirst({
    where: { trackingNumber },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payoutStatus: true,
      fulfillmentStatus: true,
      deliveredAt: true,
    },
  })

  if (!order) {
    console.log("[aftership-webhook]", { trackingNumber, tag, result: "order_not_found" })
    return NextResponse.json({ ok: true, skipped: "order_not_found" })
  }

  if (isInTransitTag(tag) && order.fulfillmentStatus !== "DELIVERED") {
    await prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: "SHIPPED" },
    })
    await recordOrderTrackingEvent({
      orderId: order.id,
      eventType: "IN_TRANSIT",
      source: "aftership_webhook",
      trackingNumber,
      fulfillmentStatus: "SHIPPED",
      verificationMethod: "aftership",
      payload: { tag },
      dedupe: tag || "in_transit",
    })
    console.log("[aftership-webhook]", { orderId: order.id, trackingNumber, tag, result: "in_transit" })
    return NextResponse.json({ ok: true, orderId: order.id, fulfillmentStatus: "SHIPPED" })
  }

  if (!isDeliveredTag(tag)) {
    return NextResponse.json({ ok: true, skipped: "not_delivered" })
  }

  if (order.fulfillmentStatus !== "DELIVERED" || !order.deliveredAt) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: "DELIVERED",
        deliveredAt: new Date(),
      },
    })
    await recordOrderTrackingEvent({
      orderId: order.id,
      eventType: "DELIVERED",
      source: "aftership_webhook",
      trackingNumber,
      fulfillmentStatus: "DELIVERED",
      verificationMethod: "aftership",
      payload: { tag },
      dedupe: "delivered",
    })
    void notifyOrderDelivered(order.id)
    console.log("[aftership-webhook]", { orderId: order.id, trackingNumber, result: "delivered" })
  }

  let payoutTriggered = false
  if (order.payoutStatus === "PENDING") {
    const payout = await triggerLightningPayout(order.id)
    payoutTriggered = payout.success
    console.log("[aftership-webhook]", {
      orderId: order.id,
      trackingNumber,
      payoutSuccess: payout.success,
      reason: payout.success ? undefined : payout.reason,
    })
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    fulfillmentStatus: "DELIVERED",
    payoutTriggered,
  })
}
