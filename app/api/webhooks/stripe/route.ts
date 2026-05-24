import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"
import { enqueueProcessTransfersJob } from "@/lib/transfers/enqueue-job"
import {
  captureStripeWebhookException,
  logStripeWebhookInfo,
} from "@/lib/stripe-webhook-observability"
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

  const existing = await prisma.processedWebhook.findUnique({ where: { id: event.id } })
  if (existing) {
    logStripeWebhookInfo({
      level: "info",
      metric: "webhook_duplicate_early",
      eventId: event.id,
      type: event.type,
      orderId: existing.orderId,
      duration_ms: Date.now() - started,
    })
    return NextResponse.json(
      { received: true, duplicate: true, orderId: existing.orderId, status: existing.status },
      { status: 200 }
    )
  }

  void (async () => {
    try {
      const result = await processStripeWebhookEvent(event)
      if (
        event.type === "checkout.session.completed" &&
        (event.data.object as Stripe.Checkout.Session).mode === "payment"
      ) {
        await enqueueProcessTransfersJob()
      }
      logStripeWebhookInfo({
        level: "info",
        metric: "webhook_background_done",
        eventId: event.id,
        type: event.type,
        orderId: result.orderId,
        duplicate: result.duplicate,
        duration_ms: Date.now() - started,
      })
    } catch (error) {
      captureStripeWebhookException(error, {
        eventId: event.id,
        type: event.type,
        phase: "webhook_background",
      })
    }
  })()

  logStripeWebhookInfo({
    level: "info",
    metric: "webhook_ack",
    eventId: event.id,
    type: event.type,
    duration_ms: Date.now() - started,
  })

  return NextResponse.json({ received: true, eventId: event.id }, { status: 200 })
}
