import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import { createBlindDropshipPaidNotifications } from "@/lib/blind-dropship-notifications"
import { handleStripeChargeRefunded } from "@/lib/stripe-charge-refunded"
import {
  processMarketplaceCommissionForPaymentIntent,
} from "@/lib/stripe-marketplace-commission-split"
import { handleStripeInvoicePaymentFailed } from "@/lib/stripe-invoice-payment-failed"
import {
  activateProFromCheckoutSession,
  deactivateProFromSubscription,
} from "@/lib/stripe-pro"
import { getStripeClient } from "@/lib/stripe"
import { inngest } from "@/inngest/client"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    console.log("=== WEBHOOK checkout.session.completed ===", {
      id: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      metadata: session.metadata,
    })

    if (session.mode === "subscription" && session.payment_status === "paid") {
      await activateProFromCheckoutSession(session)
    }

    if (session.mode === "payment" && session.payment_status === "paid") {
      const orderId = session.metadata?.orderId
      if (!orderId) {
        console.error("WEBHOOK ERROR: No orderId in session metadata")
      } else {
        const { handleMarketplaceThreeWaySplit } = await import(
          "@/lib/stripe-marketplace-commission-split"
        )
        await handleMarketplaceThreeWaySplit(session, orderId)
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    try {
      await deactivateProFromSubscription(subscription)
    } catch (e) {
      console.error("[stripe/webhook] pro deactivation", e)
      return NextResponse.json({ error: "pro_deactivation_failed" }, { status: 500 })
    }
    return NextResponse.json({ received: true })
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    try {
      const result = await handleStripeInvoicePaymentFailed(invoice)
      return NextResponse.json({ received: true, ...result })
    } catch (e) {
      console.error("[stripe/webhook] invoice.payment_failed", e)
      return NextResponse.json({ error: "payment_failed_handler_failed" }, { status: 500 })
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge
    try {
      const { processedOrderIds } = await handleStripeChargeRefunded(charge)
      return NextResponse.json({ received: true, processedOrderIds })
    } catch (e) {
      console.error("[stripe/webhook] charge.refunded", e)
      return NextResponse.json({ error: "refund_handler_failed" }, { status: 500 })
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent
    const blindId = pi.metadata?.blindDropshipOrderId?.trim()
    if (!blindId || pi.metadata?.flow !== "blind_dropship") {
      try {
        const settlement = await processMarketplaceCommissionForPaymentIntent(pi)
        if (settlement.processedOrderIds.length > 0) {
          return NextResponse.json({ received: true, settlement })
        }
        if (settlement.errors.length > 0) {
          const retriable = settlement.errors.some((e) => e.includes("orders_not_found"))
          if (!retriable) {
            return NextResponse.json({ error: "settlement_failed", settlement }, { status: 500 })
          }
        }
      } catch (e) {
        console.error("webhook: payment_intent.succeeded settlement error", e)
        return NextResponse.json({ error: "settlement_failed" }, { status: 500 })
      }
    }

    if (blindId && pi.metadata?.flow === "blind_dropship") {
      const paid = Math.round(pi.amount_received ?? pi.amount ?? 0)
      const order = await prisma.blindDropshipOrder.findUnique({ where: { id: blindId } })
      if (order && order.status === "pending_payment") {
        if (paid >= order.totalPaidCents - 1) {
          await prisma.blindDropshipOrder.update({
            where: { id: blindId },
            data: { status: "paid" },
          })
          try {
            await createBlindDropshipPaidNotifications(blindId)
          } catch (e) {
            console.error("[blind-dropship] paid notifications failed", e)
          }
          try {
            await inngest.send({ name: "blind/order.fulfill", data: { orderId: blindId } })
          } catch (e) {
            console.error("[blind-dropship] inngest.send failed", e)
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
