import { prisma } from "@/lib/prisma"

const MAX_BATCH = 48

/** Public like count = authenticated Wishlist + anonymous GuestWishlist rows. */
export async function countProductLikes(productIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BATCH)
  const map = new Map<string, number>()
  if (ids.length === 0) return map

  const [wishlistRows, guestRows] = await Promise.all([
    prisma.wishlist.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.guestWishlist.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _count: { _all: true },
    }),
  ])

  for (const id of ids) map.set(id, 0)
  for (const row of wishlistRows) {
    map.set(row.productId, (map.get(row.productId) ?? 0) + row._count._all)
  }
  for (const row of guestRows) {
    map.set(row.productId, (map.get(row.productId) ?? 0) + row._count._all)
  }
  return map
}

export async function countProductLikesSingle(productId: string): Promise<number> {
  const map = await countProductLikes([productId])
  return map.get(productId.trim()) ?? 0
}
