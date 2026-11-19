import type { Prisma } from "@prisma/client"

import { evaluateListingReadiness } from "../listing-compliance/evaluate"
import { LISTING_COMPLIANCE_KEYS } from "../listing-compliance/keys"

/**
 * Collector of `report:listing-readiness` — reads only (the caller passes a read-only transaction). Kept apart from
 * the script so it can be exercised on a real non-production PostgreSQL (`read-only-reports-db.test.ts`).
 */
const BATCH = 500

type Bucket = { products: number; ready: number; missing: Record<string, number> }

export async function collectListingReadinessReport(prisma: Prisma.TransactionClient, opts: { limit?: number } = {}) {
  const LIMIT = opts.limit ?? 20_000
  const overall: Bucket = { products: 0, ready: 0, missing: {} }
  const perSupplier = new Map<string, Bucket>()
  let advisoryNoGtin = 0
  let cursor: string | undefined
  let scanned = 0

  for (;;) {
    const rows = await prisma.product.findMany({
      where: { isDraft: false, active: true, listingKind: "PHYSICAL" },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        supplierId: true,
        listingKind: true,
        attributes: { where: { key: { in: [...LISTING_COMPLIANCE_KEYS] } }, select: { key: true, value: true } },
      },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    scanned += rows.length

    for (const p of rows) {
      const r = evaluateListingReadiness({ listingKind: p.listingKind, attributes: p.attributes })
      const bucket = perSupplier.get(p.supplierId) ?? { products: 0, ready: 0, missing: {} }
      for (const b of [overall, bucket]) {
        b.products += 1
        if (r.ready) b.ready += 1
        for (const i of r.blocking) b.missing[i.code] = (b.missing[i.code] ?? 0) + 1
      }
      if (r.advisory.some((i) => i.code === "gtin_missing")) advisoryNoGtin += 1
      perSupplier.set(p.supplierId, bucket)
    }
    if (scanned >= LIMIT) break
  }

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)
  const topSuppliers = [...perSupplier.entries()]
    .map(([supplierId, b]) => ({ supplierId, products: b.products, notReady: b.products - b.ready }))
    .filter((s) => s.notReady > 0)
    .sort((a, b) => b.notReady - a.notReady)
    .slice(0, 10)

  const report = {
    generatedAt: new Date().toISOString(),
    livePhysicalProducts: overall.products,
    truncatedAtLimit: scanned >= LIMIT,
    readyToPublish: overall.ready,
    readyPct: pct(overall.ready, overall.products),
    wouldBeRefusedIfPublishedToday: overall.products - overall.ready,
    suppliersWithLiveProducts: perSupplier.size,
    suppliersFullyReady: [...perSupplier.values()].filter((b) => b.ready === b.products).length,
    missingByCode: Object.fromEntries(Object.entries(overall.missing).sort((a, b) => b[1] - a[1])),
    withoutGtin: advisoryNoGtin,
    topSuppliersToHelp: topSuppliers,
    note:
      "These are EXISTING listings: they are never blocked (only new publications can be refused in enforce mode). The figure shows how much of the catalogue already meets the rule.",
  }
  return report
}
