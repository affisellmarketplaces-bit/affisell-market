import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { after } from "next/server"
import type Stripe from "stripe"

import {
  clientIpFromRequest,
  errorMessage,
  errorStackSnippet,
  flushLogs,
  logger,
} from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"
import { enqueueProcessTransfersJob } from "@/lib/transfers/enqueue-job"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUTE = "stripe/webhook"

/**
 * Legacy Stripe webhook URL — delegates to the same processor as `/api/webhooks/stripe`
 * so cart checkouts (no `orderId` metadata) and fulfillment still run.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")
    const ip = clientIpFromRequest(req)

    if (!signature) {
      await logger.warn("Webhook missing signature", { route: ROUTE, ip })
      await flushLogs()
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (!secret) {
      await logger.error("STRIPE_WEBHOOK_SECRET not configured", { route: ROUTE, ip })
      await flushLogs()
      return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 })
    }

    await logger.info("Webhook hit", { route: ROUTE, ip, bytes: body.length })

    const stripe = getStripeClient()
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret)
    } catch (e) {
      await logger.warn("Webhook invalid signature", {
        route: ROUTE,
        ip,
        error: errorMessage(e),
      })
      await flushLogs()
      return NextResponse.json({ error: errorMessage(e) }, { status: 400 })
    }

    const existing = await prisma.processedWebhook.findUnique({ where: { id: event.id } })
    if (existing) {
      await logger.info("Webhook duplicate", {
        route: ROUTE,
        eventId: event.id,
        eventType: event.type,
        orderId: existing.orderId,
      })
      await flushLogs()
      return NextResponse.json(
        { received: true, duplicate: true, orderId: existing.orderId, status: existing.status },
        { status: 200 }
      )
    }

    const result = await processStripeWebhookEvent(event)

    if (
      event.type === "checkout.session.completed" &&
      (event.data.object as Stripe.Checkout.Session).mode === "payment" &&
      result.status !== "failed"
    ) {
      after(() => enqueueProcessTransfersJob())
    }

    if (result.status === "failed") {
      await logger.error("Webhook handler failed", {
        route: ROUTE,
        eventId: event.id,
        eventType: event.type,
        orderId: result.orderId,
        status: result.status,
      })
      await flushLogs()
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
    }

    await logger.info("Webhook processed", {
      route: ROUTE,
      eventId: event.id,
      eventType: event.type,
      orderId: result.orderId,
      status: result.status,
    })
    await flushLogs()
    return NextResponse.json({ received: true, orderId: result.orderId, status: result.status })
  } catch (e) {
    Sentry.captureException(e)
    await logger.error("Webhook failed", {
      route: ROUTE,
      error: errorMessage(e),
      stack: errorStackSnippet(e),
    })
    await flushLogs()
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
