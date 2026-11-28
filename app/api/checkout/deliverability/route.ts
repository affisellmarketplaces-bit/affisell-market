import { NextResponse } from "next/server"

import { checkoutDeliverabilityMode } from "@/lib/checkout/deliverability"
import { lineDeliverability } from "@/lib/checkout/deliverability.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/checkout/deliverability?ids=<listingId>,<listingId>… — READ-ONLY, advisory: which cart lines cannot be paid
 * right now (their supplier channel is closed), so the cart can say so BEFORE the buyer clicks "Pay". The payment
 * paths keep their own server gate (assertCheckoutDeliverable): this endpoint never authorises anything.
 * Returns listing ids only — no channel, no reason internals.
 */
export async function GET(req: Request) {
  const ids = [
    ...new Set(
      (new URL(req.url).searchParams.get("ids") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
    .filter((s) => s.length <= 64)
    .slice(0, 50)
  if (ids.length === 0) return NextResponse.json({ unavailableProductIds: [] })
  if (checkoutDeliverabilityMode(process.env.CHECKOUT_DELIVERABILITY_MODE) !== "enforce") {
    return NextResponse.json({ unavailableProductIds: [] })
  }
  const listings = await prisma.affiliateProduct.findMany({
    where: { id: { in: ids } },
    select: { id: true, productId: true },
  })
  const verdicts = new Map<string, boolean>()
  for (const productId of [...new Set(listings.map((l) => l.productId))]) {
    verdicts.set(productId, (await lineDeliverability(productId)).deliverable)
  }
  const unavailable = listings.filter((l) => verdicts.get(l.productId) === false).map((l) => l.id)
  return NextResponse.json({ unavailableProductIds: unavailable }, { headers: { "Cache-Control": "no-store" } })
}
