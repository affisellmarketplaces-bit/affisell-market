import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { identifyAndEstablishBuyerSession } from "@/lib/buyer-identify-session"
import { marketplaceCheckoutPOST } from "@/lib/marketplace-checkout"
import { mergeGuestCartLinesForUser } from "@/lib/merge-guest-cart-server"
import type { GuestCartItem } from "@/lib/guest-cart"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type IdentifiedCheckoutBody = {
  channel?: string
  email?: string
  phone?: string
  checkout?: Record<string, unknown>
  guestCartItems?: GuestCartItem[]
}

/** One roundtrip: identify buyer → session cookie → Stripe Checkout URL. */
export async function POST(req: Request) {
  try {
    const limited = rateLimitResponse(rateLimitClientKey(req), {
      prefix: "checkout-identified",
      limit: 30,
      windowMs: 60_000,
    })
    if (limited) return limited

    const body = (await req.json().catch(() => ({}))) as IdentifiedCheckoutBody
    const channel = body.channel === "phone" ? "phone" : body.channel === "email" ? "email" : null
    if (!channel) {
      return NextResponse.json({ error: "Choisissez e-mail ou téléphone." }, { status: 400 })
    }
    if (!body.checkout || typeof body.checkout !== "object") {
      return NextResponse.json({ error: "missing_checkout" }, { status: 400 })
    }

    const identified =
      channel === "email"
        ? await identifyAndEstablishBuyerSession({
            channel: "email",
            email: typeof body.email === "string" ? body.email : "",
          })
        : await identifyAndEstablishBuyerSession({
            channel: "phone",
            phone: typeof body.phone === "string" ? body.phone : "",
          })

    if (!identified.ok) {
      return NextResponse.json({ error: identified.error }, { status: identified.status })
    }

    if (Array.isArray(body.guestCartItems) && body.guestCartItems.length > 0) {
      const lines = body.guestCartItems
        .map((item) => ({
          productId: item.productId,
          qty: item.qty,
          selectedColor: item.selectedColor ?? null,
          selectedSize: item.selectedSize ?? null,
        }))
        .filter((row) => row.productId?.trim())
      if (lines.length > 0) {
        void mergeGuestCartLinesForUser(identified.userId, lines).catch((error: unknown) => {
          console.error("[checkout-identified]", {
            userId: identified.userId,
            result: "guest_cart_merge_failed",
            error: error instanceof Error ? error.message : String(error),
          })
        })
      }
    }

    const checkoutRequest = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(body.checkout),
    })

    const checkoutResponse = await marketplaceCheckoutPOST(checkoutRequest, {
      buyerUserId: identified.userId,
    })

    console.log("[checkout-identified]", {
      userId: identified.userId,
      isNew: identified.isNew,
      channel,
      status: checkoutResponse.status,
      result: checkoutResponse.ok ? "checkout_ready" : "checkout_failed",
    })

    return checkoutResponse
  } catch (error) {
    console.error("[checkout-identified]", {
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "checkout_identify_failed" }, { status: 500 })
  }
}
