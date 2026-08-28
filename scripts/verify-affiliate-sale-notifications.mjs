#!/usr/bin/env node
/**
 * Preflight — affiliate sale alert ledger (commission / markup / fee / HT|TTC).
 * Run: npm run verify:affiliate-sale-notifications
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

const required = [
  "lib/marketplace-order-notification-breakdown.ts",
  "lib/marketplace-order-notification-heal.ts",
  "lib/marketplace-order-notifications.ts",
  "lib/marketplace-order-settlement.ts",
  "lib/merchant-notification-display.ts",
  "components/merchant/merchant-notification-item.tsx",
  "app/api/affiliate/notifications/route.ts",
]

for (const rel of required) {
  if (existsSync(resolve(root, rel))) ok(`File ${rel}`)
  else fail(`File ${rel}`, "Missing affiliate sale notification module")
}

const vitest = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "lib/__tests__/marketplace-order-notification-breakdown.test.ts",
    "lib/__tests__/marketplace-order-notification-settlement-sync.test.ts",
    "lib/__tests__/merchant-notification-display.test.ts",
    "lib/__tests__/marketplace-order-notifications.test.ts",
  ],
  { cwd: root, stdio: "pipe", encoding: "utf8" }
)

if (vitest.status === 0) ok("Vitest affiliate sale notification suite")
else {
  fail("Vitest affiliate sale notification suite", vitest.stderr?.slice(-800) || vitest.stdout?.slice(-800))
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\nverify:affiliate-sale-notifications — ${failed.length} check(s) failed`)
  process.exit(1)
}

console.log("\nverify:affiliate-sale-notifications — all checks passed")
