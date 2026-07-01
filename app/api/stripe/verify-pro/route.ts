import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  activateProFromCheckoutSession,
  PRO_VIDEO_QUOTA,
  resolveUserIdForProCheckout,
  subscriptionHasProPrice,
} from "@/lib/stripe-pro"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Idempotent backup when Stripe webhook is delayed or missing (e.g. local dev). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let sessionId: string | null = null
  try {
    const body = (await req.json()) as { sessionId?: unknown }
    if (typeof body.sessionId === "string") sessionId = body.sessionId.trim()
  } catch {
    /* empty body */
  }

  try {
    const stripe = getStripeClient()

    if (sessionId) {
      const checkout = await stripe.checkout.sessions.retrieve(sessionId)
      const ownerId = await resolveUserIdForProCheckout(checkout)
      if (!ownerId || ownerId !== session.user.id) {
        return NextResponse.json({ error: "Checkout does not belong to this account" }, { status: 403 })
      }
      const result = await activateProFromCheckoutSession(checkout)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isPro: true },
      })
      return NextResponse.json({
        isPro: Boolean(user?.isPro),
        activated: result.activated,
        reason: result.activated ? null : result.reason,
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, stripeCustomerId: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (user.isPro) {
      return NextResponse.json({ isPro: true, activated: false, reason: "already_pro" })
    }
    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 10,
    })
    const sub = subs.data.find((row) => subscriptionHasProPrice(row))
    if (!sub) {
      return NextResponse.json({ error: "No active Pro subscription found" }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isPro: true,
        videoQuota: PRO_VIDEO_QUOTA,
        stripeSubscriptionId: sub.id,
        proActivatedAt: new Date(),
      },
    })

    return NextResponse.json({ isPro: true, activated: true, reason: null })
  } catch (e) {
    const message = e instanceof Error ? e.message : "verify_failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
