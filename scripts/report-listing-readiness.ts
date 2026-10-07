/**
 * READ-ONLY coverage report for the listing-readiness rules: how many LIVE physical products already carry the GPSR /
 * identity data, i.e. how many publications would be refused if LISTING_READINESS_MODE=enforce. Never writes.
 *
 *   npm run report:listing-readiness            # human-readable
 *   npm run report:listing-readiness -- --json
 *   npm run report:listing-readiness -- --limit=5000     # cap the number of products read (default 20000)
 *
 * Uses the DATABASE_URL of .env.local / .env — read that carefully: the default one may be PRODUCTION (reads only).
 * Decide when to flip `warn` -> `enforce` from this report plus the "[listing-readiness]" log lines.
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

import { evaluateListingReadiness } from "../lib/listing-compliance/evaluate"
import { LISTING_COMPLIANCE_KEYS } from "../lib/listing-compliance/keys"

config({ path: ".env.local" })
config({ path: ".env" })

const asJson = process.argv.includes("--json")
const BATCH = 500
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "--limit=20000").split("=")[1]) || 20000
const prisma = new PrismaClient()

type Bucket = { products: number; ready: number; missing: Record<string, number> }

async function main() {
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

main()
  .catch((e) => {
    console.error("report failed:", e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
