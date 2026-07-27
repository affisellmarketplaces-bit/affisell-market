import { prisma } from "@/lib/prisma"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Lowest listing selling price observed in the last 30 days (DGCCRF reference).
 * Falls back to current sellingPriceCents when no history yet.
 */
export async function resolveListingLowestPrice30dCents(args: {
  listingId: string
  currentSellingPriceCents: number
}): Promise<{ cents: number; source: "lowest_30d" | "listing_current" }> {
  const listingId = args.listingId.trim()
  const current = Math.max(0, Math.round(args.currentSellingPriceCents))
  if (!listingId) {
    return { cents: current, source: "listing_current" }
  }

  const since = new Date(Date.now() - THIRTY_DAYS_MS)
  try {
    const agg = await prisma.priceHistory.aggregate({
      where: {
        listingId,
        createdAt: { gte: since },
        priceCents: { gt: 0 },
      },
      _min: { priceCents: true },
    })
    const lowest = agg._min.priceCents
    if (typeof lowest === "number" && lowest > 0) {
      return { cents: Math.min(lowest, current || lowest), source: "lowest_30d" }
    }
  } catch (e) {
    console.log("[pulse-battle]", {
      result: "price_history_agg_failed",
      listingId,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  return { cents: current, source: "listing_current" }
}

/** Idempotent-ish snapshot of a listing price (checkout / price change). */
export async function recordListingPriceHistory(args: {
  listingId: string
  priceCents: number
}): Promise<void> {
  const listingId = args.listingId.trim()
  const priceCents = Math.max(0, Math.round(args.priceCents))
  if (!listingId || priceCents < 1) return

  try {
    await prisma.priceHistory.create({
      data: { listingId, priceCents },
    })
  } catch (e) {
    console.log("[pulse-battle]", {
      result: "price_history_write_failed",
      listingId,
      priceCents,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/** Primary listed AffiliateProduct for a Product (battle contender). */
export async function findPrimaryListingForProduct(productId: string): Promise<{
  id: string
  sellingPriceCents: number
  affiliateId: string
} | null> {
  const row = await prisma.affiliateProduct.findFirst({
    where: { productId, isListed: true },
    orderBy: { conversions: "desc" },
    select: { id: true, sellingPriceCents: true, affiliateId: true },
  })
  return row
}
