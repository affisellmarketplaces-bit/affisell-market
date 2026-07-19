import "server-only"

import { crawlBestSellers } from "@/lib/radar/crawler/category-crawler"
import { RADAR_SCAN_CATEGORIES } from "@/lib/radar/crawler/types"
import { MARKETPLACE_CONNECTORS } from "@/lib/radar/connectors/registry"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled } from "@/lib/radar/gate"
import { upsertProductSnapshot } from "@/lib/radar/writers/product-writer"

const DEFAULT_COUNTRY = "US"

export type RadarGlobalScanResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  scanned: number
  new: number
  updated: number
  errors: number
  /** Present when TikTok/Serper keys are absent — Amazon/local still ran. */
  degraded?: boolean
  missingOptional?: string[]
}

function marketplaceScanOrder(): string[] {
  const ids = MARKETPLACE_CONNECTORS.map((c) => c.id)
  const priority = ["tiktok_shop", "amazon"]
  return [
    ...priority.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !priority.includes(id)),
  ]
}

function missingOptionalCrawlerKeys(): string[] {
  const keys = ["TIKTOK_CRAWLER_ACCESS_TOKEN", "SERPER_API_KEY"] as const
  return keys.filter((k) => !process.env[k]?.trim())
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

  const missingOptional = missingOptionalCrawlerKeys()
  if (missingOptional.length > 0) {
    console.log("[radar/global-scan]", {
      result: "degraded_mode",
      missingOptional,
      note: "TikTok/Serper skipped; Amazon + local sources continue",
    })
  }

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
          const result = await upsertProductSnapshot({
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
          })
          if (result.created) created += 1
          else updated += 1
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
    degraded: missingOptional.length > 0,
  })

  return {
    ok: true,
    scanned,
    new: created,
    updated,
    errors: errorCount,
    ...(missingOptional.length > 0
      ? { degraded: true, missingOptional }
      : {}),
  }
}
