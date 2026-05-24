import { type NextRequest, NextResponse } from "next/server"

import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return NextResponse.json({
      paid: session.payment_status === "paid",
      orderId: session.metadata?.orderId ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "verify_failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
