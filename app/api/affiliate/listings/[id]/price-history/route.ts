import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/listings/:id/price-history — the selling-price history of ONE of the signed-in reseller's own
 * listings (ListingPriceHistory, written by the database trigger). Another reseller's listing answers 404, exactly like a
 * listing that does not exist (no existence leak). Read-only. A database without the migration answers `available: false`.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    prefix: "listing-price-history",
    limit: 60,
    windowMs: 60_000,
  })
  if (limited) return limited

  const { id } = await ctx.params
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, affiliateId: userId },
    select: { id: true, productId: true, sellingPriceCents: true },
  })
  if (!listing) return NextResponse.json({ error: "not_found" }, { status: 404 })

  try {
    const rows = await prisma.listingPriceHistory.findMany({
      // Both keys: the listing AND the owner, so a row can never be served to anyone else.
      where: { affiliateProductId: listing.id, affiliateId: userId },
      orderBy: { id: "desc" },
      take: 500,
      select: { variantKey: true, priceCents: true, previousCents: true, currency: true, source: true, effectiveAt: true },
    })
    return NextResponse.json({
      available: true,
      listingId: listing.id,
      currentPriceCents: listing.sellingPriceCents,
      changes: rows.map((r: { variantKey: string | null; priceCents: number | null; previousCents: number | null; currency: string; source: string; effectiveAt: Date }) => ({
        variantKey: r.variantKey,
        priceCents: r.priceCents,
        previousCents: r.previousCents,
        currency: r.currency,
        source: r.source,
        effectiveAt: r.effectiveAt.toISOString(),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/ListingPriceHistory|P2021|does not exist/i.test(message)) {
      return NextResponse.json({ available: false, listingId: listing.id, changes: [] })
    }
    throw error
  }
}
