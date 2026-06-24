import { NextResponse } from "next/server"

import { createMedusaStripePaymentSession } from "@/lib/medusa/checkout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MedusaCheckoutBody = {
  cart_id?: string
  medusa?: boolean
}

function isMedusaCheckoutBody(body: unknown): body is MedusaCheckoutBody & { cart_id: string } {
  if (!body || typeof body !== "object") return false
  const row = body as MedusaCheckoutBody
  return typeof row.cart_id === "string" && row.cart_id.trim().length > 0
}

/** Medusa v2 Stripe Payment Intent session (client_secret) for store carts. */
export async function medusaCheckoutPOST(body: { cart_id: string }) {
  try {
    const result = await createMedusaStripePaymentSession(body.cart_id.trim())
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[medusa-checkout]", { cart_id: body.cart_id, result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export { isMedusaCheckoutBody }
