/**
 * READ-ONLY report for the checkout stock guard (CHECKOUT_STOCK_MODE): how many LIVE physical products carry a stock that
 * is not a maintained inventory, i.e. how many sales the guard would refuse (before the payment) or would turn into
 * unallocated lines (after it) if CHECKOUT_STOCK_MODE=enforce. Never writes.
 *
 *   npm run report:checkout-stock            # human-readable
 *   npm run report:checkout-stock -- --json
 *   npm run report:checkout-stock -- --limit=5000     # cap the number of variant products scanned (default 20000)
 *
 * Uses the DATABASE_URL of the shell, else .env.local, else .env. `--target` prints the database, the tables and the
 * read-only guarantees WITHOUT connecting; a production (or unidentified) database is read only with
 * `--confirm-endpoint=<endpoint id>` (the founder's authorisation). Reads run in a READ ONLY transaction.
 * Decide when to flip `warn` -> `enforce` from this report plus the "[stock] would_decrement" / "[stock] would_drop" and
 * "[checkout] would_refuse_insufficient_stock" log lines. In `warn` (the default) the guard is a DRY RUN: it writes nothing
 * to `Product.stock` and refuses nothing — it only logs what `enforce` WOULD do. The guard treats `Product.stock` as the
 * inventory; the Express wizard writes 99, the classic form defaults to 0, importers write 1 / 99 / 999 — those rows are
 * exactly what this report counts.
 */
import { runReadOnlyReport } from "./lib/read-only-report"


import { collectCheckoutStockReport } from "../lib/reports/checkout-stock-report"

const asJson = process.argv.includes("--json")
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "--limit=20000").split("=")[1]) || 20000

function print(report: Awaited<ReturnType<typeof collectCheckoutStockReport>>) {
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

runReadOnlyReport(
  { tables: ["Product"], purpose: "stocks des produits en ligne (CHECKOUT_STOCK_MODE)" },
  (tx) => collectCheckoutStockReport(tx, { limit: LIMIT }),
  print
).catch((e) => {
  console.error("report failed:", e instanceof Error ? e.message : e)
  process.exitCode = 1
})
