/**
 * READ-ONLY coverage report for the listing-readiness rules: how many LIVE physical products already carry the GPSR /
 * identity data, i.e. how many publications would be refused if LISTING_READINESS_MODE=enforce. Never writes.
 *
 *   npm run report:listing-readiness            # human-readable
 *   npm run report:listing-readiness -- --json
 *   npm run report:listing-readiness -- --limit=5000     # cap the number of products read (default 20000)
 *
 * Uses the DATABASE_URL of the shell, else .env.local, else .env. `--target` prints the database, the tables and the
 * read-only guarantees WITHOUT connecting; a production (or unidentified) database is read only with
 * `--confirm-endpoint=<endpoint id>` (the founder's authorisation). Reads run in a READ ONLY transaction.
 * Decide when to flip `warn` -> `enforce` from this report plus the "[listing-readiness]" log lines.
 */

import { runReadOnlyReport } from "./lib/read-only-report"
import { collectListingReadinessReport } from "../lib/reports/listing-readiness-report"

const asJson = process.argv.includes("--json")
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "--limit=20000").split("=")[1]) || 20000

function print(report: Awaited<ReturnType<typeof collectListingReadinessReport>>) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`\nListing readiness — ${report.generatedAt}`)
  console.log(`  Live physical products : ${report.livePhysicalProducts}`)
  console.log(`  Already meet the rule  : ${report.readyToPublish} (${report.readyPct}%)`)
  console.log(`  Suppliers fully ready  : ${report.suppliersFullyReady} / ${report.suppliersWithLiveProducts}`)
  console.log("  Missing, by code:")
  for (const [code, n] of Object.entries(report.missingByCode)) console.log(`    ${String(n).padStart(6)}  ${code}`)
  console.log(`  Without GTIN (advisory): ${report.withoutGtin}`)
  console.log("  Suppliers with most products to complete:")
  for (const s of report.topSuppliersToHelp) console.log(`    ${s.supplierId}  ${s.notReady}/${s.products}`)
  console.log(`\n  ${report.note}\n`)
}

runReadOnlyReport(
  { tables: ["Product", "ProductAttribute (clés de conformité)"], purpose: "couverture des données de sécurité produit (LISTING_READINESS_MODE)" },
  (tx) => collectListingReadinessReport(tx, { limit: LIMIT }),
  print
).catch((e) => {
  console.error("report failed:", e instanceof Error ? e.message : e)
  process.exitCode = 1
})
