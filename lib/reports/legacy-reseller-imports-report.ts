import type { Prisma } from "@prisma/client"

import { LISTING_COMPLIANCE_KEYS } from "../listing-compliance/keys"
import { summarizeLegacyImports, type LegacyImportInventory, type LegacyImportRow } from "../reseller-import/legacy-inventory"
import { IMPORT_REVIEW_TAG_PREFIX, IMPORT_REVIEW_STATES, RESELLER_URL_IMPORT_SOURCE_VALUE } from "../reseller-import/review"

/**
 * Collector of `report:legacy-reseller-imports` — reads only (the caller passes a read-only transaction). Kept apart
 * from the script so it can be exercised on a real non-production PostgreSQL (`read-only-reports-db.test.ts`).
 */
const BATCH = 200
const LIMIT = 20_000

export async function collectLegacyResellerImports(
  tx: Prisma.TransactionClient,
  now: Date = new Date()
): Promise<{ inventory: LegacyImportInventory; truncated: boolean }> {
  const since90 = new Date(now.getTime() - 90 * 86_400_000)
  const reviewTags = IMPORT_REVIEW_STATES.map((s) => `${IMPORT_REVIEW_TAG_PREFIX}${s}`)
  const rows: LegacyImportRow[] = []
  let cursor: string | undefined
  for (;;) {
    const batch = await tx.product.findMany({
      where: { importSource: RESELLER_URL_IMPORT_SOURCE_VALUE, NOT: { tags: { hasSome: reviewTags } } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        createdAt: true,
        active: true,
        isDraft: true,
        listingKind: true,
        sourceUrl: true,
        basePriceCents: true,
        stock: true,
        images: true,
        description: true,
        attributes: { where: { key: { in: [...LISTING_COMPLIANCE_KEYS] } }, select: { key: true, value: true } },
        affiliateProducts: { select: { isListed: true, affiliateId: true } },
      },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1]!.id
    const ids = batch.map((p) => p.id)
    const [recent, allTime, recalls] = await Promise.all([
      tx.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: since90 } }, _count: { _all: true } }),
      tx.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { not: null } }, _count: { _all: true } }),
      tx.productRecall.groupBy({ by: ["productId"], where: { productId: { in: ids }, status: { not: "closed" } }, _count: { _all: true } }),
    ])
    const count = (list: Array<{ productId: string; _count: { _all: number } }>) =>
      new Map(list.map((r) => [r.productId, r._count._all]))
    const recentBy = count(recent)
    const allBy = count(allTime)
    const recallBy = count(recalls)
    for (const p of batch) {
      rows.push({
        createdAt: p.createdAt,
        active: p.active,
        isDraft: p.isDraft,
        listingKind: p.listingKind,
        sourceUrl: p.sourceUrl,
        basePriceCents: p.basePriceCents,
        stock: p.stock,
        imageCount: p.images.length,
        descriptionLength: p.description.replace(/<[^>]*>/g, "").trim().length,
        attributes: p.attributes,
        listings: p.affiliateProducts,
        paidOrders90d: recentBy.get(p.id) ?? 0,
        paidOrdersAllTime: allBy.get(p.id) ?? 0,
        openRecalls: recallBy.get(p.id) ?? 0,
      })
    }
    if (rows.length >= LIMIT) break
  }
  return { inventory: summarizeLegacyImports(rows), truncated: rows.length >= LIMIT }
}

