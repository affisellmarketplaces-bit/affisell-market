import "server-only"

import { getRadarDb } from "@/lib/prisma-radar"
import { MARKETPLACE_CONNECTORS } from "@/lib/radar/connectors/registry"
import { crawlBestSellers } from "@/lib/radar/crawler/category-crawler"
import { RADAR_SCAN_CATEGORIES } from "@/lib/radar/crawler/types"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled } from "@/lib/radar/gate"

const DEFAULT_COUNTRY = "US"

export type RadarGlobalScanResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  scanned: number
  new: number
  updated: number
  errors: number
}

function marketplaceScanOrder(): string[] {
  const ids = MARKETPLACE_CONNECTORS.map((c) => c.id)
  const priority = ["tiktok_shop", "amazon"]
  return [
    ...priority.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !priority.includes(id)),
  ]
}

/** Shared global scan used by cron + authenticated Force Scan. */
export async function runRadarGlobalScan(): Promise<RadarGlobalScanResult> {
  if (!isRadarEnabled()) {
    console.log("[radar/global-scan]", { result: "skipped_disabled" })
    return { ok: true, skipped: true, reason: "RADAR_ENABLED=false", scanned: 0, new: 0, updated: 0, errors: 0 }
  }

  if (!resolveRadarDatabaseUrl()) {
    console.log("[radar/global-scan]", { result: "skipped_no_db" })
    return { ok: true, skipped: true, reason: "no_database_url", scanned: 0, new: 0, updated: 0, errors: 0 }
  }

  const db = getRadarDb()
  let scanned = 0
  let created = 0
  let updated = 0
  let errorCount = 0

  for (const marketplaceId of marketplaceScanOrder()) {
    for (const category of RADAR_SCAN_CATEGORIES) {
      try {
        const products = await crawlBestSellers(marketplaceId, category, DEFAULT_COUNTRY)
        scanned += products.length

        for (const p of products) {
          const existing = await db.radarGlobalSnapshot.findUnique({
            where: {
              marketplaceId_externalId_country: {
                marketplaceId: p.marketplaceId,
                externalId: p.externalId,
                country: p.country,
              },
            },
            select: { id: true },
          })

          await db.radarGlobalSnapshot.upsert({
            where: {
              marketplaceId_externalId_country: {
                marketplaceId: p.marketplaceId,
                externalId: p.externalId,
                country: p.country,
              },
            },
            create: {
              marketplaceId: p.marketplaceId,
              externalId: p.externalId,
              title: p.title,
              price: p.price,
              category: p.category ?? category,
              country: p.country,
              rank: p.rank,
              salesEst: p.salesEst,
              url: p.url,
              currency: p.currency,
              imageUrl: p.imageUrl,
              crawledAt: p.crawledAt,
            },
            update: {
              title: p.title,
              price: p.price,
              category: p.category ?? category,
              rank: p.rank,
              salesEst: p.salesEst,
              url: p.url,
              currency: p.currency,
              imageUrl: p.imageUrl,
              crawledAt: p.crawledAt,
            },
          })

          if (existing) updated += 1
          else created += 1
        }
      } catch (err) {
        errorCount += 1
        console.error("[radar/global-scan]", {
          marketplaceId,
          category,
          result: "marketplace_failed",
          message: err instanceof Error ? err.message : "unknown",
        })
      }
    }
  }

  console.log("[radar/global-scan]", {
    result: "done",
    scanned,
    new: created,
    updated,
    errors: errorCount,
  })

  return { ok: true, scanned, new: created, updated, errors: errorCount }
}
