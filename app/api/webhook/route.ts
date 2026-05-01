import { NextResponse } from "next/server"
import Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
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
    const message = error instanceof Error ? error.message : "Invalid signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session
    const metadata = s.metadata || {}

    const existing = await prisma.order.findUnique({
      where: { stripeSessionId: s.id },
    })
    if (existing) {
      return NextResponse.json({ received: true })
    }

    const userIdRaw = metadata.userId?.trim()
    await prisma.order.create({
      data: {
        userId: userIdRaw || null,
        productId: metadata.productId || undefined,
        affiliateId: metadata.affiliateId?.trim() || null,
        supplierId: metadata.supplierId?.trim() || null,
        amount: s.amount_total ?? 0,
        currency: s.currency ?? "eur",
        status: "PAID",
        stripeSessionId: s.id,
      },
    })
  }

  return NextResponse.json({ received: true })
}
