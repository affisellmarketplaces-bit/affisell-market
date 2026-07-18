import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import {
  activateRadarFromCheckoutSession,
  syncRadarFromSubscription,
  subscriptionHasRadarPrice,
} from "@/lib/stripe-radar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Idempotent backup when Stripe webhook is delayed (Radar checkout). */
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
      const metaUser = checkout.metadata?.userId?.trim()
      if (metaUser && metaUser !== session.user.id) {
        return NextResponse.json({ error: "Checkout does not belong to this account" }, { status: 403 })
      }
      const result = await activateRadarFromCheckoutSession(checkout)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { radarPlan: true },
      })
      return NextResponse.json({
        radarPlan: user?.radarPlan ?? "free",
        activated: result.activated,
        reason: result.activated ? null : result.reason,
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { radarPlan: true, stripeCustomerId: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (user.radarPlan === "pro" || user.radarPlan === "global") {
      return NextResponse.json({
        radarPlan: user.radarPlan,
        activated: false,
        reason: "already_radar",
      })
    }
    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 10,
    })
    const sub = subs.data.find((row) => subscriptionHasRadarPrice(row))
    if (!sub) {
      return NextResponse.json({ error: "No active Radar subscription found" }, { status: 404 })
    }

    const synced = await syncRadarFromSubscription(sub)
    const refreshed = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { radarPlan: true },
    })

    return NextResponse.json({
      radarPlan: refreshed?.radarPlan ?? "free",
      activated: !synced.skipped,
      reason: synced.skipped ? synced.reason : null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "verify_failed"
    console.error("[radar-paywall]", { result: "verify_error", message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
