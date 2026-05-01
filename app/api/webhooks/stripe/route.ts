import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

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
    const now = new Date()
    const deliverableAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id

    await prisma.order.create({
      data: {
        userId: session.metadata?.userId || null,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
        status: "PAID",
        stripePaymentIntentId: paymentIntentId ?? undefined,
        deliverableAt,
      },
    })
  }

  return NextResponse.json({ received: true })
}
