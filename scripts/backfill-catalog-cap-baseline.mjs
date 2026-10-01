#!/usr/bin/env node
/**
 * One-off backfill for the Growth catalog cap (lib/growth/catalog-cap.server.ts).
 *
 * For every SUPPLIER not on Dominator/Empire, sets catalogCapBaselineCount to their current
 * live (isDraft:false) product count — so the cap (effective = max(200, baseline)) never
 * retroactively blocks a supplier who already had more than 200 products before this shipped.
 * Idempotent: skips suppliers whose baseline is already set.
 *
 * Usage:
 *   node scripts/backfill-catalog-cap-baseline.mjs            # dry run, prints stats only
 *   node scripts/backfill-catalog-cap-baseline.mjs --apply    # actually writes
 *   DATABASE_URL=$DATABASE_URL_STAGING node scripts/backfill-catalog-cap-baseline.mjs --apply
 */
import { loadEnv } from "../lib/env.loader.mjs"

loadEnv()

const apply = process.argv.includes("--apply")

const { PrismaClient } = await import("@prisma/client")
const prisma = new PrismaClient()

const suppliers = await prisma.user.findMany({
  where: {
    role: "SUPPLIER",
    growthPlan: { notIn: ["dominator", "empire"] },
    catalogCapBaselineCount: null,
  },
  select: { id: true, email: true },
})

console.log(`[backfill] ${suppliers.length} supplier(s) without a baseline yet`)

const counts = []
for (const supplier of suppliers) {
  const current = await prisma.product.count({ where: { supplierId: supplier.id, isDraft: false } })
  counts.push({ id: supplier.id, email: supplier.email, current })
}

counts.sort((a, b) => b.current - a.current)
const top = counts.slice(0, 10)
console.log("[backfill] Top 10 by live product count:")
for (const row of top) {
  console.log(`  ${row.current.toString().padStart(6)}  ${row.email}`)
}

const max = counts[0]?.current ?? 0
const aboveDefault = counts.filter((c) => c.current > 200).length
console.log(`[backfill] Max live count: ${max}`)
console.log(`[backfill] Suppliers already above the 200 default cap: ${aboveDefault}`)

if (!apply) {
  console.log("\n[backfill] Dry run only — re-run with --apply to write catalogCapBaselineCount.")
  await prisma.$disconnect()
  process.exit(0)
}

let written = 0
for (const row of counts) {
  await prisma.user.update({ where: { id: row.id }, data: { catalogCapBaselineCount: row.current } })
  written += 1
}
console.log(`\n[backfill] Wrote catalogCapBaselineCount for ${written} supplier(s).`)

await prisma.$disconnect()
