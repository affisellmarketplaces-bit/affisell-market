import { type NextRequest, NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import {
  ensureMarketplaceCheckoutFulfilled,
  isMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

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
    const [session, initialOrderIds] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      findOrderIdsForCheckoutSession(sessionId),
    ])

    let orderIds = initialOrderIds

    const paid = session.payment_status === "paid"
    const needsFulfillment =
      session.mode === "payment" && paid && (await marketplaceCheckoutNeedsFulfillment(sessionId))

    if (needsFulfillment) {
      await ensureMarketplaceCheckoutFulfilled(session)
      orderIds = await findOrderIdsForCheckoutSession(sessionId)

      for (const orderId of orderIds) {
        await scheduleMarketplaceTransferAttempts(session, orderId)
      }
    }

    const fulfilled = paid && (await isMarketplaceCheckoutFulfilled(sessionId))

    return NextResponse.json({
      paid,
      orderId: orderIds[0] ?? session.metadata?.orderId ?? null,
      orderIds,
      fulfilled,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? "eur",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "verify_failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
