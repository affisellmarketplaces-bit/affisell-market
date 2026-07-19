import "server-only"

import { checkPriceWar } from "@/lib/radar/alerts/rules"
import type { SnapshotLike } from "@/lib/radar/alerts/types"
import { loadSnapshotHistory } from "@/lib/radar/detectors/snapshot-history"

export { checkPriceWar }

/**
 * Query last 7 days of price history and run PRICE_WAR.
 * Returns null when fewer than 2 distinct day rows exist.
 */
export async function detectPriceWar(current: SnapshotLike) {
  const history = await loadSnapshotHistory(
    {
      marketplaceId: current.marketplaceId,
      externalId: current.externalId,
      country: current.country,
    },
    7
  )
  return checkPriceWar({
    current,
    history,
    saturationSellerCount: 0,
    trendingKeywords: [],
  })
}
