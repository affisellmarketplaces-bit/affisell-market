/**
 * READ-ONLY report for the checkout stock guard (CHECKOUT_STOCK_MODE): how many LIVE physical products carry a stock that
 * is not a maintained inventory, i.e. how many sales the guard would refuse (before the payment) or would turn into
 * unallocated lines (after it) if CHECKOUT_STOCK_MODE=enforce. Never writes.
 *
 *   npm run report:checkout-stock            # human-readable
 *   npm run report:checkout-stock -- --json
 *   npm run report:checkout-stock -- --limit=5000     # cap the number of variant products scanned (default 20000)
 *
 * Uses the DATABASE_URL of .env.local / .env — read that carefully: the default one may be PRODUCTION (reads only).
 * Decide when to flip `warn` -> `enforce` from this report plus the "[stock] would_decrement" / "[stock] would_drop" and
 * "[checkout] would_refuse_insufficient_stock" log lines. In `warn` (the default) the guard is a DRY RUN: it writes nothing
 * to `Product.stock` and refuses nothing — it only logs what `enforce` WOULD do. The guard treats `Product.stock` as the
 * inventory; the Express wizard writes 99, the classic form defaults to 0, importers write 1 / 99 / 999 — those rows are
 * exactly what this report counts.
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const asJson = process.argv.includes("--json")
const BATCH = 500
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "--limit=20000").split("=")[1]) || 20000
const prisma = new PrismaClient()

const LIVE_PHYSICAL = { isDraft: false, active: true, listingKind: "PHYSICAL" } as const
/** Values that importers / wizards write as a placeholder, not as an inventory. */
const PLACEHOLDER_STOCKS = [1, 99, 100, 999]

async function main() {
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

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`\nCheckout stock guard — ${report.generatedAt}`)
  console.log(`  Live physical products        : ${report.livePhysicalProducts}`)
  console.log(`  With stock <= 0 (enforce would refuse them) : ${report.stockZeroOrLess} (${report.stockZeroOrLessPct}%)`)
  console.log(`  With stock 1..3               : ${report.stockOneToThree}`)
  console.log("  Placeholder-looking stocks (value : products):")
  for (const [value, n] of Object.entries(report.placeholderStockCounts)) console.log(`    ${value.padStart(5)} : ${n}`)
  console.log(`  Variant products              : ${report.variantProducts} (table-only, left unmanaged: ${report.tableOnlyVariantProducts})`)
  console.log("  Suppliers with most empty-stock products:")
  for (const s of report.topSuppliersWithEmptyStock) console.log(`    ${s.supplierId}  ${s.products}`)
  console.log(`\n  ${report.note}\n`)
}

main()
  .catch((e) => {
    console.error("report failed:", e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
