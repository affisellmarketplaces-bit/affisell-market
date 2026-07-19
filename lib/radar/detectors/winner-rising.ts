import "server-only"

import { checkWinnerRising } from "@/lib/radar/alerts/rules"
import type { SnapshotLike } from "@/lib/radar/alerts/types"
import { loadSnapshotHistory } from "@/lib/radar/detectors/snapshot-history"

export { checkWinnerRising }

/**
 * Query last 7 days of ProductSnapshot rows and run WINNER_RISING.
 * Returns null when history is insufficient (single day).
 */
export async function detectWinnerRising(current: SnapshotLike) {
  const history = await loadSnapshotHistory(
    {
      marketplaceId: current.marketplaceId,
      externalId: current.externalId,
      country: current.country,
    },
    7
  )
  return checkWinnerRising({
    current,
    history,
    saturationSellerCount: 0,
    trendingKeywords: [],
  })
}
