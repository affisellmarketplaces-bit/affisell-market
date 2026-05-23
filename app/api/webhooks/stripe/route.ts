import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import { createBlindDropshipPaidNotifications } from "@/lib/blind-dropship-notifications"
import { handleStripeChargeRefunded } from "@/lib/stripe-charge-refunded"
import { processMarketplaceCommissionForPaymentIntent } from "@/lib/stripe-marketplace-commission-split"
import { syncOrderVatFromCheckoutSession } from "@/lib/stripe-sync-order-vat-from-session"
import { handleStripeInvoicePaymentFailed } from "@/lib/stripe-invoice-payment-failed"
import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import {
  activateProFromCheckoutSession,
  deactivateProFromSubscription,
  isProSubscriptionCheckout,
} from "@/lib/stripe-pro"
import { getStripeClient } from "@/lib/stripe"
import { inngest } from "@/inngest/client"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function addressFromSession(session: Stripe.Checkout.Session): Record<string, unknown> {
  const extended = session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Stripe.Address | null; name?: string | null } | null
  }
  const ship = extended.shipping_details ?? null
  if (ship?.address) return { ...(ship.address as object), name: ship.name }
  const bill = session.customer_details
  if (bill?.address) return { ...(bill.address as object), name: bill.name }
  return {}
}

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
    if (isProSubscriptionCheckout(session)) {
      try {
        await activateProFromCheckoutSession(session)
      } catch (e) {
        console.error("[stripe/webhook] pro activation", e)
        return NextResponse.json({ error: "pro_activation_failed" }, { status: 500 })
      }
      return NextResponse.json({ received: true })
    }
    const customerEmail =
      session.customer_email ||
      session.customer_details?.email ||
      session.customer_details?.phone ||
      "unknown@checkout"

    const shippingAddress = addressFromSession(session) as Prisma.InputJsonValue

    try {
      await fulfillMarketplaceStripeSession(session, shippingAddress, customerEmail)
      const vatSync = await syncOrderVatFromCheckoutSession(session.id)
      const piRef = session.payment_intent
      const piId = typeof piRef === "string" ? piRef : piRef?.id
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId)
        const commission = await processMarketplaceCommissionForPaymentIntent(pi)
        return NextResponse.json({ received: true, fulfilled: true, vatSync, commission })
      }
      return NextResponse.json({ received: true, fulfilled: true, vatSync })
    } catch (e) {
      console.error("fulfillMarketplaceStripeSession", e)
      return NextResponse.json({ error: "fulfill_failed" }, { status: 500 })
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
        const commission = await processMarketplaceCommissionForPaymentIntent(pi)
        if (commission.processedOrderIds.length > 0) {
          return NextResponse.json({ received: true, commission })
        }
        if (commission.errors.length > 0) {
          return NextResponse.json({ error: "commission_split_failed", commission }, { status: 500 })
        }
      } catch (e) {
        console.error("[stripe/webhook] marketplace commission split", e)
        return NextResponse.json({ error: "commission_split_failed" }, { status: 500 })
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
