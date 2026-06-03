import "server-only"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { countProductLikesSingle } from "@/lib/product-like-count"
import { prisma } from "@/lib/prisma"

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

export async function toggleGuestWishlist(
  guestId: string,
  productId: string
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
    data: { guestId, productId },
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
      targetPriceCents: null,
      dropPercent: 0,
    }
  })
}

/** Idempotent: copy guest likes into authenticated wishlist after sign-in. */
export async function mergeGuestWishlistForUser(
  userId: string,
  guestId: string
): Promise<{ merged: number; skipped: number }> {
  const guestIdNorm = guestId.trim()
  if (!guestIdNorm || !userId) return { merged: 0, skipped: 0 }

  const rows = await prisma.guestWishlist.findMany({
    where: { guestId: guestIdNorm },
    select: { productId: true },
  })
  if (rows.length === 0) return { merged: 0, skipped: 0 }

  let merged = 0
  let skipped = 0

  for (const { productId } of rows) {
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    })
    if (existing) {
      skipped += 1
      continue
    }
    await prisma.wishlist.create({
      data: { userId, productId },
    })
    merged += 1
  }

  await prisma.guestWishlist.deleteMany({ where: { guestId: guestIdNorm } })
  console.log("[guest-wishlist-merge]", { userId, guestId: guestIdNorm, merged, skipped })
  return { merged, skipped }
}
