import { type NextRequest, NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Buyer lands here after Stripe Checkout — idempotent backup if the webhook was delayed or dropped. */
export async function GET(req: NextRequest) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "stripe-verify-session",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited

  const sessionId = req.nextUrl.searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.mode === "payment" && session.payment_status === "paid") {
      await ensureMarketplaceCheckoutFulfilled(session)
    }

    const orderIds = await findOrderIdsForCheckoutSession(sessionId)

    return NextResponse.json({
      paid: session.payment_status === "paid",
      orderId: orderIds[0] ?? session.metadata?.orderId ?? null,
      orderIds,
      fulfilled: orderIds.length > 0,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "verify_failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
