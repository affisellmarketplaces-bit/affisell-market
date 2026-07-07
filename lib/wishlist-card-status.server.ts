import {
  guestWishlistProductIds,
} from "@/lib/guest-wishlist-server"
import { countProductLikes } from "@/lib/product-like-count"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type WishlistCardStatusRow = {
  wished: boolean
  dropPercent: number
  likeCount: number
}

const MAX_BATCH = 48

function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

async function currentPricesForProducts(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (productIds.length === 0) return map

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      ...buyerListedAffiliateProductWhere,
    },
    select: { productId: true, sellingPriceCents: true },
    orderBy: { id: "asc" },
  })
  for (const row of listings) {
    if (!map.has(row.productId)) map.set(row.productId, row.sellingPriceCents)
  }
  return map
}

export function normalizeWishlistStatusIds(raw: string[]): string[] {
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_BATCH)
}

/** Batch wishlist heart state for marketplace product cards. */
export async function resolveWishlistCardStatuses(
  rawIds: string[],
  options: { userId: string | null; guestId: string | null }
): Promise<Record<string, WishlistCardStatusRow>> {
  const ids = normalizeWishlistStatusIds(rawIds)
  if (ids.length === 0) return {}

  const { userId, guestId } = options

  try {
    return await withPrismaReconnect(async () => {
      const [likeCounts, userItems, guestWished, priceMap] = await Promise.all([
        countProductLikes(ids),
        userId
          ? prisma.wishlist.findMany({
              where: { userId, productId: { in: ids } },
              select: { productId: true, previousPriceCents: true },
            })
          : Promise.resolve([]),
        guestId ? guestWishlistProductIds(guestId, ids) : Promise.resolve(new Set<string>()),
        currentPricesForProducts(ids),
      ])
      const itemByProduct = new Map(userItems.map((i) => [i.productId, i]))
      const statuses: Record<string, WishlistCardStatusRow> = {}
      for (const id of ids) {
        const item = itemByProduct.get(id)
        const current = priceMap.get(id) ?? null
        statuses[id] = {
          wished: Boolean(item) || guestWished.has(id),
          dropPercent:
            item && current != null ? dropPercent(current, item.previousPriceCents) : 0,
          likeCount: likeCounts.get(id) ?? 0,
        }
      }
      return statuses
    })
  } catch (error) {
    console.error("[wishlist-card-status]", { idCount: ids.length, error })
    return Object.fromEntries(
      ids.map((id) => [id, { wished: false, dropPercent: 0, likeCount: 0 }])
    )
  }
}
