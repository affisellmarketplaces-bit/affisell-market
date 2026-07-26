import { unstable_cache } from "next/cache"

import { countAffiliateCreatorsWatchingProduct } from "@/lib/affiliate-product-opportunity-pulse"
import { prisma } from "@/lib/prisma"

const SOCIAL_REVALIDATE_SEC = 120

async function countViewsLast24h(productId: string): Promise<number> {
  try {
    const since = new Date()
    since.setUTCMinutes(since.getUTCMinutes() - 24 * 60)
    return await prisma.affisellTrackEvent.count({
      where: {
        eventType: "view",
        productId,
        createdAt: { gte: since },
      },
    })
  } catch {
    return 0
  }
}

/** Cross-request cache — social badges must not block cold PDP TTFB twice. */
export function loadListingSocialProofCached(productId: string): Promise<{
  viewsLast24h: number
  affiliateCreatorsWatching: number
}> {
  const id = productId.trim()
  if (!id) {
    return Promise.resolve({ viewsLast24h: 0, affiliateCreatorsWatching: 0 })
  }
  return unstable_cache(
    async () => {
      const [viewsLast24h, affiliateCreatorsWatching] = await Promise.all([
        countViewsLast24h(id),
        countAffiliateCreatorsWatchingProduct(id),
      ])
      return { viewsLast24h, affiliateCreatorsWatching }
    },
    ["listing-social-proof", id],
    { revalidate: SOCIAL_REVALIDATE_SEC, tags: [`listing-social-${id}`] }
  )()
}
