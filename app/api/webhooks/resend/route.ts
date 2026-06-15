import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"

import { processExpansionResendDeliveryEvent } from "@/lib/resend-webhook/expansion-email-delivery"
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

  const expansionResult = await processExpansionResendDeliveryEvent(
    {
      type: event.type,
      created_at: event.created_at,
      data: event.data as Parameters<typeof processExpansionResendDeliveryEvent>[0]["data"],
    },
    svixId
  )

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  return NextResponse.json({
    received: true,
    type: event.type,
    expansion: expansionResult,
  })
}
