import "server-only"

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
