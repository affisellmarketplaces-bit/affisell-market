import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { requiresVariantChoice } from "@/lib/variant-selection"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * PUBLIC, READ-ONLY: must the buyer choose a size / colour / capacity before buying this listing? Asked by the card
 * « buy » and « add to cart » buttons, which carry no choice (founder brief 2026-11-19 §2): when the answer is yes the
 * shopper is sent to the product page to choose — nothing is ever chosen for them. Answers a single boolean (same
 * visibility as the marketplace: an unlisted product is « not found »). A failed read answers `requiresChoice: false`
 * with `unknown: true`, so a card keeps its existing behaviour (the checkout's own check still applies).
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), { prefix: "variant-choice", limit: 60, windowMs: 60_000 })
  if (limited) return limited
  const { id } = await context.params
  const listingId = typeof id === "string" ? id.trim().slice(0, 64) : ""
  if (!listingId) return NextResponse.json({ error: "not_found" }, { status: 404 })
  try {
    const listing = await prisma.affiliateProduct.findFirst({
      where: { id: listingId, ...buyerListedAffiliateProductWhere },
      select: {
        product: {
          select: { variants: true, customColumns: true, listingKind: true, _count: { select: { productVariants: true } } },
        },
      },
    })
    if (!listing?.product) return NextResponse.json({ error: "not_found" }, { status: 404 })
    const physical = (listing.product.listingKind ?? "PHYSICAL").trim().toUpperCase() === "PHYSICAL"
    const requiresChoice =
      physical &&
      requiresVariantChoice({
        variants: listing.product.variants,
        customColumns: listing.product.customColumns,
        tableVariantCount: listing.product._count.productVariants,
      })
    return NextResponse.json({ requiresChoice }, { headers: { "Cache-Control": "private, max-age=30" } })
  } catch {
    return NextResponse.json({ requiresChoice: false, unknown: true })
  }
}
