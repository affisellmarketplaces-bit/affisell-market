#!/usr/bin/env node
/**
 * LTV loop pre-flight — review nudges, wishlist push crons, Prisma migration wiring.
 * Run: node scripts/verify-ltv-ops-ready.mjs
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

function read(rel) {
  const path = resolve(root, rel)
  if (!existsSync(path)) return null
  return readFileSync(path, "utf8")
}

const schema = read("prisma/schema.prisma")
if (schema?.includes("reviewEarlyNudgeSentAt")) {
  ok("Prisma schema: Order.reviewEarlyNudgeSentAt")
} else {
  fail("Prisma schema", "Missing reviewEarlyNudgeSentAt on Order")
}

const migration = read(
  "prisma/migrations/20260706203000_order_review_early_nudge_sent_at/migration.sql"
)
if (migration?.includes("reviewEarlyNudgeSentAt")) {
  ok("Migration reviewEarlyNudgeSentAt present")
} else {
  fail("Migration", "Missing 20260706203000_order_review_early_nudge_sent_at")
}

for (const route of [
  "app/api/cron/review-early-nudge/route.ts",
  "app/api/cron/review-reminder/route.ts",
  "app/api/cron/wishlist-price-alerts/route.ts",
  "lib/cron/review-early-nudge.ts",
  "lib/order-review-push.ts",
]) {
  if (existsSync(resolve(root, route))) ok(`File ${route}`)
  else fail(`File ${route}`, "Missing LTV cron/lib module")
}

const workflow = read(".github/workflows/scheduled-crons.yml")
const requiredCronPaths = [
  "/api/cron/migrate",
  "/api/cron/review-early-nudge",
  "/api/cron/review-reminder",
  "/api/cron/wishlist-price-alerts",
]
if (workflow) {
  for (const path of requiredCronPaths) {
    if (workflow.includes(path)) ok(`scheduled-crons.yml includes ${path}`)
    else fail("scheduled-crons.yml", `Missing ${path} in daily job`)
  }
} else {
  fail("scheduled-crons.yml", "Workflow file missing")
}

const failed = checks.filter((c) => !c.pass)
console.log("\n[verify-ltv-ops] LTV crons + migration wiring\n")
for (const c of checks) {
  const icon = c.pass ? "✓" : "✗"
  console.log(`  ${icon} ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.log(`\n[verify-ltv-ops] ${failed.length} check(s) failed.\n`)
  process.exit(1)
}

console.log("\n[verify-ltv-ops] Ready — run daily migrate + review crons on prod after deploy.\n")
console.log("  curl -H \"Authorization: Bearer $CRON_SECRET\" \"$VERCEL_APP_URL/api/cron/migrate\"")
console.log(
  "  curl -H \"Authorization: Bearer $CRON_SECRET\" \"$VERCEL_APP_URL/api/cron/review-early-nudge\""
)
