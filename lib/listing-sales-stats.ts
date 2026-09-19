import "server-only"

import { Prisma } from "@prisma/client"

import type { SalesStats } from "@/lib/listing-sales-count"
import { prisma } from "@/lib/prisma"

/** Order statuses that never count as a sale (compared lowercase). */
const NON_SALE_STATUSES = ["cancelled", "canceled", "refunded", "pending", "failed", "expired"]

type Row = {
  id: string
  units: number
  units7d: number
  units24h: number
  last_paid: Date | null
}

/**
 * CONFIRMED sales per listing: units of orders that were paid and not cancelled / refunded.
 * This — not the `AffiliateProduct.conversions` counter (bumped at order creation, never decremented) — is what
 * buyers may be shown. One grouped query for any number of listings.
 */
export async function loadListingSalesStats(listingIds: readonly string[]): Promise<Map<string, SalesStats>> {
  const ids = [...new Set(listingIds.filter(Boolean))]
  const out = new Map<string, SalesStats>()
  if (ids.length === 0) return out

  const now = Date.now()
  const d7 = new Date(now - 7 * 24 * 3600 * 1000)
  const d1 = new Date(now - 24 * 3600 * 1000)

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT "affiliateProductId" AS id,
           COALESCE(SUM("quantity"), 0)::int AS units,
           COALESCE(SUM("quantity") FILTER (WHERE "paidAt" >= ${d7}), 0)::int AS units7d,
           COALESCE(SUM("quantity") FILTER (WHERE "paidAt" >= ${d1}), 0)::int AS units24h,
           MAX("paidAt") AS last_paid
    FROM "Order"
    WHERE "affiliateProductId" IN (${Prisma.join(ids)})
      AND "paidAt" IS NOT NULL
      AND lower("status") NOT IN (${Prisma.join(NON_SALE_STATUSES)})
    GROUP BY "affiliateProductId"
  `)

  for (const r of rows) {
    out.set(r.id, {
      units: Number(r.units) || 0,
      units7d: Number(r.units7d) || 0,
      units24h: Number(r.units24h) || 0,
      lastPaidAt: r.last_paid ? new Date(r.last_paid).toISOString() : null,
    })
  }
  return out
}

/** Confirmed units for a single listing (0 when none). */
export async function loadListingConfirmedUnits(listingId: string): Promise<number> {
  return (await loadListingSalesStats([listingId])).get(listingId)?.units ?? 0
}
