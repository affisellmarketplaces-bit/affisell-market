import { NextResponse } from "next/server"
import type Stripe from "stripe"

import {
  activateProFromCheckoutSession,
  deactivateProFromSubscription,
} from "@/lib/stripe-pro"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
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
            console.error("WEBHOOK ERROR: No orderId")
            break
          }
          const { handleMarketplaceThreeWaySplit } = await import(
            "@/lib/stripe-marketplace-commission-split"
          )
          await handleMarketplaceThreeWaySplit(session, orderId)
        }
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await deactivateProFromSubscription(subscription)
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error("[stripe/webhook]", event.type, e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
