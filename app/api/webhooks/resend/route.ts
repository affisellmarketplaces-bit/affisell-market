import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"

import { processExpansionResendDeliveredEvent } from "@/lib/resend-webhook/expansion-email-delivered"
import { processExpansionResendDeliveryEvent } from "@/lib/resend-webhook/expansion-email-delivery"
import type { ResendWebhookEmailData } from "@/lib/resend-webhook/expansion-email-delivery"
import { recordExpansionBounceEvent } from "@/lib/resend-webhook/record-expansion-bounce-event"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET not configured" }, { status: 503 })
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const payload = await req.text()

  let event: { type: string; created_at?: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const id = `resend:${svixId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const emailData = event.data as ResendWebhookEmailData
  const emailId = typeof event.data.email_id === "string" ? event.data.email_id : svixId

  const [expansionResult, deliveredResult] = await Promise.all([
    processExpansionResendDeliveryEvent(
      {
        type: event.type,
        created_at: event.created_at,
        data: emailData,
      },
      svixId
    ),
    processExpansionResendDeliveredEvent(
      {
        type: event.type,
        data: emailData,
      },
      emailId
    ),
  ])

  await recordExpansionBounceEvent(event.type, emailData, emailId)

  await prisma.processedWebhook.create({
    data: {
      id,
      status:
        expansionResult.webhookStatus ??
        deliveredResult.webhookStatus ??
        "success",
      error: expansionResult.handled
        ? emailData.to?.[0] ?? null
        : deliveredResult.countryIso2
          ? `${deliveredResult.countryIso2}:delivered`
          : null,
    },
  })

  return NextResponse.json({
    received: true,
    type: event.type,
    expansion: expansionResult,
    delivered: deliveredResult,
  })
}
