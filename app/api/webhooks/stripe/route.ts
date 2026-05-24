import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
  const started = Date.now()
  const stripe = getStripeClient()
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  const isDevFixture =
    process.env.NODE_ENV === "development" && signature === "test"
  try {
    if (isDevFixture) {
      event = JSON.parse(body) as Stripe.Event
    } else {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const result = await processStripeWebhookEvent(event)

  logStripeWebhookInfo({
    metric: "webhook_done",
    eventId: event.id,
    type: event.type,
    duplicate: result.duplicate,
    orderId: result.orderId,
    durationMs: Date.now() - started,
  })

  return NextResponse.json(
    { received: true, duplicate: result.duplicate, orderId: result.orderId },
    { status: 200 }
  )
}
