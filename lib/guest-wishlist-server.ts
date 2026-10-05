import "server-only"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { countProductLikesSingle } from "@/lib/product-like-count"
import { prisma } from "@/lib/prisma"
import { wishlistPriceDropPercent } from "@/lib/wishlist-price-alert"
import { currentPricesForProducts } from "@/lib/wishlist-current-price.server"

export async function guestWishlistProductIds(
  guestId: string,
  productIds: string[]
): Promise<Set<string>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  if (!guestId || ids.length === 0) return new Set()

  const rows = await prisma.guestWishlist.findMany({
    where: { guestId, productId: { in: ids } },
    select: { productId: true },
  })
  return new Set(rows.map((r) => r.productId))
}

export type GuestWishlistPriceIntent = {
  /** Alert threshold in cents (Pulse saves 95 % of the current price). */
  targetPriceCents?: number | null
  /** Price seen when saving — the baseline "price dropped since" is measured against. */
  previousPriceCents?: number | null
}

export async function toggleGuestWishlist(
  guestId: string,
  productId: string,
  intent: GuestWishlistPriceIntent = {}
): Promise<{ wished: boolean; likeCount: number }> {
  const exists = await prisma.guestWishlist.findUnique({
    where: { guestId_productId: { guestId, productId } },
    select: { id: true },
  })

  if (exists) {
    await prisma.guestWishlist.delete({
      where: { guestId_productId: { guestId, productId } },
    })
    const likeCount = await countProductLikesSingle(productId)
    console.log("[guest-wishlist]", { productId, guestId, result: "unliked", likeCount })
    return { wished: false, likeCount }
  }

  await prisma.guestWishlist.create({
    data: {
      guestId,
      productId,
      targetPriceCents: intent.targetPriceCents ?? null,
      previousPriceCents: intent.previousPriceCents ?? null,
    },
  })
  const likeCount = await countProductLikesSingle(productId)
  console.log("[guest-wishlist]", { productId, guestId, result: "liked", likeCount })
  return { wished: true, likeCount }
}

export type WishlistDisplayRow = {
  productId: string
  name: string
  imageUrl: string | null
  listingId: string | null
  currentPriceCents: number | null
  targetPriceCents: number | null
  dropPercent: number
}

/** Guest favorites for `/wishlist` page (no account required). */
export async function listGuestWishlistForDisplay(guestId: string): Promise<WishlistDisplayRow[]> {
  const guestIdNorm = guestId.trim()
  if (!guestIdNorm) return []

  const rows = await prisma.guestWishlist.findMany({
    where: { guestId: guestIdNorm },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          affiliateProducts: {
            where: buyerListedAffiliateProductWhere,
            take: 1,
            orderBy: { id: "asc" },
            select: { id: true, sellingPriceCents: true },
          },
        },
      },
    },
  })

  return rows.map((w) => {
    const listing = w.product.affiliateProducts[0] ?? null
    const current = listing?.sellingPriceCents ?? null
    return {
      productId: w.productId,
      name: w.product.name,
      imageUrl: w.product.images[0] ?? null,
      listingId: listing?.id ?? null,
      currentPriceCents: current,
      targetPriceCents: w.targetPriceCents,
      // No live listing → no current price → nothing to compare (a null would read as a 100 % drop).
      dropPercent: current != null ? wishlistPriceDropPercent(current, w.previousPriceCents) : 0,
    }
  })
}

/**
 * Idempotent: copy guest favourites into the authenticated wishlist after sign-in.
 *
 * The price intent travels with them — a row without a baseline (`previousPriceCents`) and a target can never raise
 * an alert, so a favourite saved "with price alert" would silently stop alerting after sign-up. A guest row saved
 * before price intent was kept gets today's price as its baseline. A favourite the buyer already has on their account
 * is never overwritten.
 */
export async function mergeGuestWishlistForUser(
  userId: string,
  guestId: string
): Promise<{ merged: number; skipped: number }> {
  const guestIdNorm = guestId.trim()
  if (!guestIdNorm || !userId) return { merged: 0, skipped: 0 }

  const rows = await prisma.guestWishlist.findMany({
    where: { guestId: guestIdNorm },
    select: { productId: true, targetPriceCents: true, previousPriceCents: true },
  })
  if (rows.length === 0) return { merged: 0, skipped: 0 }

  const existing = await prisma.wishlist.findMany({
    where: { userId, productId: { in: rows.map((r) => r.productId) } },
    select: { productId: true },
  })
  const already = new Set(existing.map((e) => e.productId))
  const toCreate = rows.filter((r) => !already.has(r.productId))

  const needsBaseline = toCreate.filter((r) => r.previousPriceCents == null).map((r) => r.productId)
  const currentPrices = await currentPricesForProducts(needsBaseline)

  const created = toCreate.length
    ? await prisma.wishlist.createMany({
        data: toCreate.map((r) => ({
          userId,
          productId: r.productId,
          targetPriceCents: r.targetPriceCents,
          previousPriceCents: r.previousPriceCents ?? currentPrices.get(r.productId) ?? null,
        })),
        // A second tab merging at the same moment must not fail on the unique (userId, productId).
        skipDuplicates: true,
      })
    : { count: 0 }

  await prisma.guestWishlist.deleteMany({ where: { guestId: guestIdNorm } })
  const merged = created.count
  const skipped = rows.length - merged
  console.log("[guest-wishlist-merge]", { userId, guestId: guestIdNorm, merged, skipped })
  return { merged, skipped }
}
