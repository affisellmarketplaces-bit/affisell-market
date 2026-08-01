import { isBlindDropshipCheckoutPayload, blindDropshipCheckoutPOST } from "@/lib/blind-dropship-checkout"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { marketplaceCheckoutPOST } from "@/lib/marketplace-checkout"
import { isMedusaCheckoutBody, medusaCheckoutPOST } from "@/lib/medusa/checkout-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Marketplace checkout — Ghost stock gate runs inside `marketplaceCheckoutPOST`
 * (lib/marketplace-checkout.ts) before Stripe Checkout Session create.
 */
export async function POST(request: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(request), {
    prefix: "checkout",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) {
    console.log("[checkout]", { result: "rate_limited" })
    return limited
  }

  try {
    const raw = await request.text()
    let parsed: unknown = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (isMedusaCheckoutBody(parsed)) {
      return medusaCheckoutPOST(parsed)
    }
    if (isBlindDropshipCheckoutPayload(parsed)) {
      return blindDropshipCheckoutPOST(parsed)
    }
    return marketplaceCheckoutPOST(
      new Request(request.url, { method: "POST", body: raw, headers: request.headers })
    )
  } catch (error) {
    console.error("[checkout]", {
      result: "unhandled_error",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ error: "checkout_failed" }, { status: 500 })
  }
}
