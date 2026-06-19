import { type NextRequest, NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { fulfillPaidCheckoutSession } from "@/lib/marketplace-checkout-success.server"

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
    const result = await fulfillPaidCheckoutSession(sessionId)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "verify_failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
