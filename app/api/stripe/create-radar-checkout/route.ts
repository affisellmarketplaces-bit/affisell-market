import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { appBaseUrl } from "@/lib/app-base-url"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import {
  parseRadarCheckoutPlan,
  resolveRadarStripePriceId,
  sanitizeRadarReturnPath,
  type RadarCheckoutPlanId,
} from "@/lib/stripe-radar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let plan: RadarCheckoutPlanId | null = null
  let returnPath = "/radar"
  try {
    const body = (await req.json()) as { plan?: unknown; returnPath?: unknown }
    plan = parseRadarCheckoutPlan(body.plan)
    returnPath = sanitizeRadarReturnPath(body.returnPath)
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!plan) {
    return NextResponse.json({ error: "plan must be pro or global" }, { status: 400 })
  }

  const priceId = resolveRadarStripePriceId(plan)
  if (!priceId) {
    console.error("[radar-paywall]", { plan, result: "price_not_configured" })
    return NextResponse.json(
      {
        error:
          plan === "global"
            ? "STRIPE_RADAR_GLOBAL_PRICE_ID is not configured"
            : "STRIPE_RADAR_PRO_PRICE_ID (or STRIPE_PRO_PRICE_ID) is not configured",
      },
      { status: 500 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      radarPlan: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.radarPlan === plan || (plan === "pro" && user.radarPlan === "global")) {
    return NextResponse.json(
      { error: plan === "global" ? "You already have Radar Global." : "You already have this Radar plan." },
      { status: 400 }
    )
  }

  const stripe = getStripeClient()
  const base = appBaseUrl()
  const stripePlanMeta = plan === "global" ? "radar_global" : "radar_pro"

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
      success_url: `${base}${returnPath}?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${returnPath}?upgrade=cancelled`,
      metadata: {
        userId: user.id,
        plan: stripePlanMeta,
        feature: "radar",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: stripePlanMeta,
          feature: "radar",
        },
      },
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 })
    }

    console.log("[radar-paywall]", {
      userId: user.id,
      plan,
      sessionId: checkoutSession.id,
      result: "checkout_created",
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed"
    console.error("[radar-paywall]", { userId: user.id, plan, result: "checkout_error", message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
