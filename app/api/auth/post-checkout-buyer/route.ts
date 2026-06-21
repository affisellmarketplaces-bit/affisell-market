import { type NextRequest, NextResponse } from "next/server"

import { identifyBuyerForCheckout } from "@/lib/buyer-identify"
import { createBuyerCheckoutMagicToken } from "@/lib/buyer-checkout-magic"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { extractMarketplaceCheckoutCustomer } from "@/lib/marketplace-checkout-session"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** After Stripe Checkout — issue a short-lived magic token to open the buyer session. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "post-checkout-buyer",
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as { sessionId?: string }
  const sessionId = body.sessionId?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "payment_not_paid" }, { status: 400 })
    }

    const { customerEmail } = extractMarketplaceCheckoutCustomer(session)
    if (!customerEmail.trim()) {
      return NextResponse.json({ error: "missing_customer_email" }, { status: 400 })
    }

    const identified = await identifyBuyerForCheckout({ channel: "email", email: customerEmail })
    if (!identified.ok) {
      console.log("[post-checkout-buyer]", {
        sessionId,
        result: "identify_failed",
        status: identified.status,
      })
      return NextResponse.json({ error: identified.error, code: "identify_failed" }, { status: identified.status })
    }

    const checkoutMagic = createBuyerCheckoutMagicToken(identified.userId)
    console.log("[post-checkout-buyer]", {
      sessionId,
      userId: identified.userId,
      isNew: identified.isNew,
      result: "magic_issued",
    })

    return NextResponse.json({
      ok: true,
      checkoutMagic,
      email: identified.email,
      isNew: identified.isNew,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[post-checkout-buyer]", { sessionId, result: "error", error: message })
    return NextResponse.json({ error: "post_checkout_buyer_failed" }, { status: 500 })
  }
}
