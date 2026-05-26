import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { appBaseUrl } from "@/lib/app-base-url"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_PRO_PRICE_ID is not configured" }, { status: 500 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      isPro: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.isPro) {
    return NextResponse.json({ error: "You already have Pro." }, { status: 400 })
  }

  const stripe = getStripeClient()
  const base = appBaseUrl()

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/supplier/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/supplier/products?upgrade=cancelled`,
      metadata: { userId: user.id, plan: "pro" },
      subscription_data: {
        metadata: { userId: user.id, plan: "pro" },
      },
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 })
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
