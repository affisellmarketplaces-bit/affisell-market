import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import { getStripeClient } from "@/lib/stripe"

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
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const customerEmail =
      session.customer_email ||
      session.customer_details?.email ||
      session.customer_details?.phone ||
      "unknown@checkout"

    const shippingAddress = addressFromSession(session) as Prisma.InputJsonValue

    try {
      await fulfillMarketplaceStripeSession(session, shippingAddress, customerEmail)
    } catch (e) {
      console.error("fulfillMarketplaceStripeSession", e)
      return NextResponse.json({ error: "fulfill_failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
