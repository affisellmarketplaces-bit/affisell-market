import { NextResponse } from "next/server"
import { after } from "next/server"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"
import { enqueueProcessTransfersJob } from "@/lib/transfers/enqueue-job"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Legacy Stripe webhook URL — delegates to the same processor as `/api/webhooks/stripe`
 * so cart checkouts (no `orderId` metadata) and fulfillment still run.
 */
export async function POST(req: Request) {
  const stripe = getStripeClient()
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const existing = await prisma.processedWebhook.findUnique({ where: { id: event.id } })
  if (existing) {
    return NextResponse.json(
      { received: true, duplicate: true, orderId: existing.orderId, status: existing.status },
      { status: 200 }
    )
  }

  try {
    const result = await processStripeWebhookEvent(event)

    if (
      event.type === "checkout.session.completed" &&
      (event.data.object as Stripe.Checkout.Session).mode === "payment" &&
      result.status !== "failed"
    ) {
      after(() => enqueueProcessTransfersJob())
    }

    if (result.status === "failed") {
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
    }

    return NextResponse.json({ received: true, orderId: result.orderId, status: result.status })
  } catch (e) {
    console.error("[stripe/webhook]", event.type, e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
