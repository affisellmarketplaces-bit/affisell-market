import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { getRadarDb } from "@/lib/prisma-radar"
import { MARKETPLACE_CONNECTORS } from "@/lib/radar/connectors/registry"
import { crawlBestSellers } from "@/lib/radar/crawler/category-crawler"
import { RADAR_SCAN_CATEGORIES } from "@/lib/radar/crawler/types"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const DEFAULT_COUNTRY = "US"

/** Prefer tiktok_shop first, then amazon, then the rest of the registry. */
function marketplaceScanOrder(): string[] {
  const ids = MARKETPLACE_CONNECTORS.map((c) => c.id)
  const priority = ["tiktok_shop", "amazon"]
  const ordered = [
    ...priority.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !priority.includes(id)),
  ]
  return ordered
}

/**
 * Global Radar scan — best sellers per marketplace × category.
 * `Authorization: Bearer ${CRON_SECRET}` — schedule every 6h.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!isRadarEnabled()) {
    console.log("[radar/cron/global-scan]", { result: "skipped_disabled" })
    return NextResponse.json({ ok: true, skipped: true, reason: "RADAR_ENABLED=false" })
  }

  if (!resolveRadarDatabaseUrl()) {
    console.log("[radar/cron/global-scan]", { result: "skipped_no_db" })
    return NextResponse.json({ ok: true, skipped: true, reason: "no_database_url" })
  }

  const db = getRadarDb()
  let scanned = 0
  let created = 0
  let updated = 0
  const errors: Array<{ marketplaceId: string; category: string; message: string }> = []

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
        const message = err instanceof Error ? err.message : "unknown"
        errors.push({ marketplaceId, category, message })
        console.error("[radar/cron/global-scan]", {
          marketplaceId,
          category,
          result: "marketplace_failed",
          message,
        })
      }
    }
  }

  console.log("[radar/cron/global-scan]", {
    result: "done",
    scanned,
    new: created,
    updated,
    errors: errors.length,
  })

  return NextResponse.json({
    ok: true,
    scanned,
    new: created,
    updated,
    errors: errors.length,
  })
}
