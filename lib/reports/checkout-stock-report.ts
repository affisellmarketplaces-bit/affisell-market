import type { Prisma } from "@prisma/client"

/**
 * Collector of `report:checkout-stock` — reads only (the caller passes a read-only transaction). Kept apart from the
 * script so it can be exercised on a real non-production PostgreSQL (`read-only-reports-db.test.ts`).
 */
const BATCH = 500
const LIVE_PHYSICAL = { isDraft: false, active: true, listingKind: "PHYSICAL" } as const
/** Values that importers / wizards write as a placeholder, not as an inventory. */
const PLACEHOLDER_STOCKS = [1, 99, 100, 999]

export async function collectCheckoutStockReport(prisma: Prisma.TransactionClient, opts: { limit?: number } = {}) {
  const LIMIT = opts.limit ?? 20_000
  const livePhysical = await prisma.product.count({ where: LIVE_PHYSICAL })
  const stockZeroOrLess = await prisma.product.count({ where: { ...LIVE_PHYSICAL, stock: { lte: 0 } } })
  const stockLow = await prisma.product.count({ where: { ...LIVE_PHYSICAL, stock: { gt: 0, lte: 3 } } })
  const placeholderRows = await prisma.product.groupBy({
    by: ["stock"],
    where: { ...LIVE_PHYSICAL, stock: { in: PLACEHOLDER_STOCKS } },
    _count: { _all: true },
  })
  const withVariants = await prisma.product.count({ where: { ...LIVE_PHYSICAL, hasVariants: true } })

  // Variant products whose stock lives only in the ProductVariant table (no `variantRows` json): the guard leaves them UNMANAGED.
  let tableOnlyVariantProducts = 0
  let scanned = 0
  let cursor: string | undefined
  for (;;) {
    const rows = await prisma.product.findMany({
      where: { ...LIVE_PHYSICAL, hasVariants: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, variants: true },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    scanned += rows.length
    for (const p of rows) {
      const v = p.variants as { variantRows?: unknown } | null
      if (!Array.isArray(v?.variantRows) || v.variantRows.length === 0) tableOnlyVariantProducts += 1
    }
    if (scanned >= LIMIT) break
  }

  const bySupplier = await prisma.product.groupBy({
    by: ["supplierId"],
    where: { ...LIVE_PHYSICAL, stock: { lte: 0 } },
    _count: { _all: true },
    orderBy: { _count: { supplierId: "desc" } },
    take: 10,
  })

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)
  const report = {
    generatedAt: new Date().toISOString(),
    livePhysicalProducts: livePhysical,
    stockZeroOrLess,
    stockZeroOrLessPct: pct(stockZeroOrLess, livePhysical),
    /** Upper bound: includes variant products that live only in the ProductVariant table, which the guard leaves unmanaged. */
    wouldBeRefusedIfEnforcedToday: stockZeroOrLess,
    stockOneToThree: stockLow,
    placeholderStockCounts: Object.fromEntries(
      placeholderRows.map((r) => [String(r.stock), r._count._all]).sort((a, b) => Number(a[0]) - Number(b[0]))
    ),
    variantProducts: withVariants,
    tableOnlyVariantProducts,
    variantScanTruncatedAtLimit: scanned >= LIMIT,
    topSuppliersWithEmptyStock: bySupplier.map((s) => ({ supplierId: s.supplierId, products: s._count._all })),
    note:
      "A product with stock <= 0 is sold out on the PDP but NOT on every surface (grid cards, discover feed): enforce would start refusing those sales. A placeholder stock (99 / 999 / 1 / 100) is not an inventory: once enforced, the decrement drains it and the product is then refused / shown sold out (in warn nothing is written). Table-only variant products are left unmanaged by the guard.",
  }
  return report
}
