#!/usr/bin/env node
/**
 * Preflight: payout unification migrations + backfill tooling present.
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const required = [
  "lib/payout-settlement.ts",
  "lib/payout-legacy-backfill.ts",
  "scripts/payout-legacy-backfill.ts",
  "app/api/admin/payout-legacy/route.ts",
  "prisma/migrations/20260705150000_payout_ledger_stripe_link/migration.sql",
  "prisma/migrations/20260705160000_mark_phantom_legacy_ledger/migration.sql",
]

let ok = true
for (const rel of required) {
  const path = resolve(root, rel)
  if (!existsSync(path)) {
    console.error(`[verify:payout-unification] missing ${rel}`)
    ok = false
  }
}

if (!ok) process.exit(1)

console.log("[verify:payout-unification] OK — migrations + backfill tooling ready")
console.log("[verify:payout-unification] prod steps:")
console.log("  1. npx prisma migrate deploy")
console.log("  2. npm run payout:legacy:scan")
console.log("  3. npm run payout:legacy:execute -- --limit=50")
