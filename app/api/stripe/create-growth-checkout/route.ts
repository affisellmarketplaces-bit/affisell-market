import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { appBaseUrl } from "@/lib/app-base-url"
import { GROWTH_PRICING_TIERS } from "@/lib/growth-pricing-tiers"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import {
  parseGrowthBillingInterval,
  parseGrowthCheckoutPlan,
  sanitizeGrowthReturnPath,
} from "@/lib/stripe-growth"
import { resolveOrEnsureStripeGrowthPriceId } from "@/lib/stripe-growth-ensure"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let plan: ReturnType<typeof parseGrowthCheckoutPlan> = null
  let interval: ReturnType<typeof parseGrowthBillingInterval> = null
  let returnPath = "/pricing"
  try {
    const body = (await req.json()) as { plan?: unknown; interval?: unknown; returnPath?: unknown }
    plan = parseGrowthCheckoutPlan(body.plan)
    interval = parseGrowthBillingInterval(body.interval) ?? "monthly"
    returnPath = sanitizeGrowthReturnPath(body.returnPath)
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!plan) {
    return NextResponse.json({ error: "plan must be lanceur, dominator or empire" }, { status: 400 })
  }
  if (!interval) {
    return NextResponse.json({ error: "interval must be monthly or annual" }, { status: 400 })
  }

  const tier = GROWTH_PRICING_TIERS[plan]

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, growthPlan: true, stripeCustomerId: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.role !== tier.role) {
    return NextResponse.json(
      { error: "ROLE_MISMATCH", message: `${tier.name} is only available to ${tier.role === "SUPPLIER" ? "suppliers" : "affiliates"}.` },
      { status: 403 }
    )
  }

  if (user.growthPlan === plan) {
    return NextResponse.json({ error: `You already have the ${tier.name} plan.` }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("[growth-paywall]", { plan, result: "stripe_secret_missing" })
    return NextResponse.json(
      { error: "STRIPE_SECRET_NOT_CONFIGURED", message: "Stripe secret key not configured" },
      { status: 503 }
    )
  }

  const priceId = await resolveOrEnsureStripeGrowthPriceId(plan, interval)
  if (!priceId) {
    console.error("[growth-paywall]", { plan, interval, result: "price_not_configured" })
    return NextResponse.json(
      { error: "STRIPE_GROWTH_NOT_CONFIGURED", message: `${tier.name} plan not configured in Stripe` },
      { status: 503 }
    )
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
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}${returnPath}?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${returnPath}?upgrade=cancelled`,
      metadata: { userId: user.id, growthPlan: plan, growthInterval: interval, feature: "growth" },
      subscription_data: {
        metadata: { userId: user.id, growthPlan: plan, growthInterval: interval, feature: "growth" },
      },
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 })
    }

    console.log("[growth-paywall]", { userId: user.id, plan, interval, sessionId: checkoutSession.id, result: "checkout_created" })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed"
    console.error("[growth-paywall]", { userId: user.id, plan, result: "checkout_error", message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
