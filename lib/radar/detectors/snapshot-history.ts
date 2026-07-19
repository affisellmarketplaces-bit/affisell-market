import "server-only"

import { getRadarDb } from "@/lib/prisma-radar"
import { utcDay } from "@/lib/radar/writers/product-writer"
import type { SnapshotLike } from "@/lib/radar/alerts/types"

export type SnapshotHistoryKey = {
  marketplaceId: string
  externalId: string
  country: string
}

/** Load last N calendar days of snapshots for a product (day-over-day history). */
export async function loadSnapshotHistory(
  key: SnapshotHistoryKey,
  days = 7
): Promise<SnapshotLike[]> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000))
  const rows = await getRadarDb().radarGlobalSnapshot.findMany({
    where: {
      marketplaceId: key.marketplaceId,
      externalId: key.externalId,
      country: key.country,
      day: { gte: since },
    },
    orderBy: [{ day: "asc" }, { crawledAt: "asc" }],
    take: Math.max(days * 2, 20),
  })
  return rows
}
