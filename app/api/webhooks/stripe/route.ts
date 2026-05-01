import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

function addressFromSession(session: Stripe.Checkout.Session): Record<string, unknown> {
  const ship = session.shipping_details ?? null
  if (ship?.address) return { ...(ship.address as object), name: ship.name }
  const bill = session.customer_details
  if (bill?.address) return { ...(bill.address as object), name: bill.name }
  return {}
}

export async function POST(req: NextRequest) {
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
    const sessionId = session.id

    const existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId } })
    if (existing) {
      return NextResponse.json({ received: true })
    }

    const affiliateProductId = session.metadata?.affiliateProductId?.trim()
    if (!affiliateProductId) {
      return NextResponse.json({ received: true })
    }

    const listing = await prisma.affiliateProduct.findUnique({
      where: { id: affiliateProductId },
      include: { product: true },
    })

    if (!listing?.product || !listing.active || !listing.product.active) {
      return NextResponse.json({ received: true })
    }

    const sellingPriceCents = listing.sellingPriceCents
    const basePriceCents = listing.product.basePriceCents
    const marginCents = Math.max(0, sellingPriceCents - basePriceCents)
    const rate = listing.product.commissionRate
    const affiliatePayoutCents = Math.floor((marginCents * rate) / 100)
    const commissionCents = affiliatePayoutCents

    const customerEmail =
      session.customer_email ||
      session.customer_details?.email ||
      session.customer_details?.phone ||
      "unknown@checkout"

    const shippingAddress = addressFromSession(session)

    const order = await prisma.order.create({
      data: {
        stripeSessionId: sessionId,
        productId: listing.productId,
        affiliateProductId: listing.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        customerEmail,
        shippingAddress,
        basePriceCents,
        sellingPriceCents,
        commissionCents,
        marginCents,
        affiliatePayoutCents,
        status: "paid",
      },
    })

    await prisma.notification.create({
      data: {
        userId: listing.product.supplierId,
        type: "NEW_ORDER",
        message: `New order · ${listing.product.name} · ship to ${customerEmail}`,
        orderId: order.id,
      },
    })
  }

  return NextResponse.json({ received: true })
}
