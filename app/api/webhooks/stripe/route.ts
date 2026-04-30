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
    const returnWindowEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const deliverableAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)

    await prisma.order.create({
      data: {
        ...({ buyerId: session.metadata?.userId || null } as object),
        total: session.amount_total! / 100,
        status: "PAID",
        stripePaymentIntentId: session.payment_intent as string,
        returnWindowEndsAt,
        deliverableAt,
      },
    })
  }

  return NextResponse.json({ received: true })
}
