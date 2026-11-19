import type { Prisma } from "@prisma/client"

import { isOrderClosedForPayout } from "../orders/payment-state"
import { summarizeReservationExposure } from "../stock-exposure"
import { resolveVariantChoice, requiresVariantChoice } from "../variant-selection"

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
  // How the variant rows read under the shared selection rule (lib/variant-selection.ts).
  let needChoice = 0
  let duplicateRowsProducts = 0
  let unnamedExtraDimension = 0
  let scanned = 0
  let cursor: string | undefined
  for (;;) {
    const rows = await prisma.product.findMany({
      where: { ...LIVE_PHYSICAL, hasVariants: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, variants: true, customColumns: true },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    scanned += rows.length
    for (const p of rows) {
      const v = p.variants as { variantRows?: unknown } | null
      if (!Array.isArray(v?.variantRows) || v.variantRows.length === 0) {
        tableOnlyVariantProducts += 1
        continue
      }
      if (requiresVariantChoice({ variants: p.variants, customColumns: p.customColumns })) {
        needChoice += 1
        const all = resolveVariantChoice(p.variants, {}, p.customColumns)
        if (all.kind === "incomplete" && all.missing.includes("other")) unnamedExtraDimension += 1
      }
      if (hasDuplicateRows(p.variants, p.customColumns)) duplicateRowsProducts += 1
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

  // Paid orders not shipped yet vs the declared stock (lib/stock-exposure.ts): both readings, never merged.
  const pendingRows = await prisma.order.findMany({
    where: { paidAt: { not: null }, shippedAt: null, trackingNumber: null },
    select: { productId: true, quantity: true, status: true, paymentSettlementStatus: true },
    take: LIMIT,
  })
  const pending = pendingRows
    .filter((o) => !isOrderClosedForPayout(o))
    .map((o) => ({ productId: o.productId as string, units: Math.max(1, o.quantity ?? 1) }))
  const pendingProductIds = [...new Set(pending.map((p) => p.productId))]
  const pendingProducts = pendingProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: pendingProductIds }, ...LIVE_PHYSICAL }, select: { id: true, stock: true } })
    : []
  const exposure = summarizeReservationExposure({
    products: pendingProducts.map((p) => ({ productId: p.id, declaredUnits: p.stock })),
    pending,
    platformDeducts: false,
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
    /** Products held as rows that need a choice before buying (cards / assistant send the shopper to the page). */
    variantProductsNeedingChoice: needChoice,
    /** Rows identical on every dimension: no row can be told apart — never decremented, the supplier must fix them. */
    variantProductsWithDuplicateRows: duplicateRowsProducts,
    /** Rows that differ only after a second « / » in their name: no picker names that dimension — never sellable as a precise row. */
    variantProductsWithUnnamedDimension: unnamedExtraDimension,
    variantScanTruncatedAtLimit: scanned >= LIMIT,
    /** Paid, not shipped, not closed — read in both ways (the deployment's CHECKOUT_STOCK_MODE decides which applies). */
    pendingOrders: { ...exposure, platformDeducts: "enforce only — read CHECKOUT_STOCK_MODE on the deployment", truncatedAtLimit: pendingRows.length >= LIMIT },
    topSuppliersWithEmptyStock: bySupplier.map((s) => ({ supplierId: s.supplierId, products: s._count._all })),
    note:
      "A product with stock <= 0 is sold out on the PDP but NOT on every surface (grid cards, discover feed): enforce would start refusing those sales. A placeholder stock (99 / 999 / 1 / 100) is not an inventory: once enforced, the decrement drains it and the product is then refused / shown sold out (in warn nothing is written). Table-only variant products are left unmanaged by the guard.",
  }
  return report
}

/** Two rows identical on every dimension of the shared rule (a duplicated line in the supplier's SKU table). */
function hasDuplicateRows(variants: unknown, customColumns: unknown): boolean {
  const rows = (variants as { variantRows?: Array<{ name?: unknown }> } | null)?.variantRows ?? []
  for (let i = 0; i < rows.length; i++) {
    const name = typeof rows[i]?.name === "string" ? (rows[i]!.name as string) : ""
    const parts = name.split(" / ")
    const r = resolveVariantChoice(variants, { color: parts[0], size: parts[1] ?? null }, customColumns)
    if (r.kind === "duplicate_rows") return true
  }
  return false
}
