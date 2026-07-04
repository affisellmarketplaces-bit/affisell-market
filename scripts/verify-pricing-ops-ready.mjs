#!/usr/bin/env node
/**
 * Pre-flight — affiliate pricing pipeline (variants, AI cron, wholesale guard, push).
 * Run: npm run verify:pricing-ops
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadDotEnv(path) {
  if (!existsSync(path)) return
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    /* .env.local may be unreadable in CI/sandbox */
  }
}

loadDotEnv(resolve(process.cwd(), "prisma/env.local"))
loadDotEnv(resolve(process.cwd(), ".env.local"))
loadDotEnv(resolve(process.cwd(), ".env"))

const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })
const warn = (label, hint) => checks.push({ label, pass: true, warn: hint })

const PRICING_MIGRATIONS = [
  "20260703140000_affiliate_variant_pricing",
  "20260704100000_affiliate_pricing_auto_adjust",
  "20260704143000_affiliate_margin_review",
]

const REQUIRED_FILES = [
  "lib/affiliate-variant-pricing.ts",
  "lib/affiliate-ai-variant-pricing.ts",
  "lib/affiliate-wholesale-change-guard.ts",
  "lib/affiliate-wholesale-change-notify.ts",
  "lib/affiliate-wholesale-change-push.ts",
  "lib/affiliate-variant-margin-analytics.ts",
  "lib/load-affiliate-variant-margin-analytics.ts",
  "app/api/cron/adjust-variant-pricing/route.ts",
  "emails/affiliate-wholesale-change.tsx",
  "components/affiliate/affiliate-push-notifications-card.tsx",
  "components/affiliate/affiliate-variant-margin-analytics-panel.tsx",
  "lib/__tests__/affiliate-variant-pricing.test.ts",
  "lib/__tests__/affiliate-wholesale-change-guard.test.ts",
  "lib/__tests__/affiliate-variant-margin-analytics.test.ts",
  "lib/__tests__/affiliate-wholesale-change-push.test.ts",
]

console.log("\n[verify-pricing-ops] Affiliate pricing pipeline\n")

for (const name of PRICING_MIGRATIONS) {
  const dir = resolve(process.cwd(), "prisma/migrations", name)
  const sql = resolve(dir, "migration.sql")
  if (existsSync(sql)) ok(`migration ${name}`)
  else fail(`migration ${name}`, "Missing — run prisma migrate dev or restore from main")
}

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
if (existsSync(schemaPath)) {
  const schema = readFileSync(schemaPath, "utf8")
  for (const col of [
    "variantPricing",
    "pricingAutoAdjust",
    "marginReviewNeeded",
    "marginReviewAlertHash",
  ]) {
    if (schema.includes(col)) ok(`schema AffiliateProduct.${col}`)
    else fail(`schema ${col}`, "Missing from prisma/schema.prisma")
  }
} else {
  fail("prisma/schema.prisma", "Missing")
}

for (const rel of REQUIRED_FILES) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing — pricing pipeline incomplete")
}

const cronRoute = resolve(process.cwd(), "app/api/cron/adjust-variant-pricing/route.ts")
if (existsSync(cronRoute)) {
  const src = readFileSync(cronRoute, "utf8")
  if (src.includes("authorizeCronRequest")) ok("cron adjust-variant-pricing auth")
  else fail("adjust-variant-pricing auth", "Must call authorizeCronRequest")
  if (src.includes("pricingAutoAdjust")) ok("cron targets pricingAutoAdjust listings")
  else fail("adjust-variant-pricing", "Must filter pricingAutoAdjust listings")
}

const workflowPath = resolve(process.cwd(), ".github/workflows/scheduled-crons.yml")
if (existsSync(workflowPath)) {
  const wf = readFileSync(workflowPath, "utf8")
  if (wf.includes("/api/cron/adjust-variant-pricing")) ok("GitHub daily cron → adjust-variant-pricing")
  else fail("scheduled-crons.yml", "Add /api/cron/adjust-variant-pricing to daily job")
  if (wf.includes("/api/cron/migrate")) ok("GitHub daily cron → migrate")
  else warn("scheduled-crons migrate", "Daily /api/cron/migrate recommended for prod schema")
} else {
  fail("scheduled-crons.yml", "Missing")
}

const supplierRoute = resolve(process.cwd(), "app/api/supplier/products/[id]/route.ts")
if (existsSync(supplierRoute)) {
  const src = readFileSync(supplierRoute, "utf8")
  if (src.includes("notifyAffiliatesAfterSupplierProductSave")) {
    ok("supplier PUT hooks wholesale change guard")
  } else {
    fail("supplier product route", "Must call notifyAffiliatesAfterSupplierProductSave")
  }
}

const pushSend = resolve(process.cwd(), "lib/web-push-send.ts")
if (existsSync(pushSend)) {
  const src = readFileSync(pushSend, "utf8")
  if (src.includes("affisell-wholesale-")) ok("web push wholesale tag")
  else fail("web-push-send", "Missing affisell-wholesale push tag")
}

if (process.env.CRON_SECRET?.trim()) {
  ok("CRON_SECRET configured")
} else {
  warn("CRON_SECRET", "Set on Vercel + GitHub secrets for adjust-variant-pricing + migrate")
}

if (process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()) {
  ok(`Resend configured (${process.env.RESEND_FROM_EMAIL.trim()})`)
} else {
  warn("Resend", "Required for wholesale change emails (affiliate-wholesale-change.tsx)")
}

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim()) {
  ok("VAPID keys configured (affiliate margin push)")
} else {
  warn("VAPID", "Required for affiliate wholesale push — npm run verify:web-push")
}

if (process.env.DATABASE_URL?.trim()) {
  const status = spawnSync("npx", ["prisma", "migrate", "status"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  })
  const out = `${status.stdout ?? ""}${status.stderr ?? ""}`
  if (status.status === 0 && !out.includes("following migration")) {
    ok("DATABASE_URL — migrations up to date")
  } else if (out.includes("following migration") || out.includes("not yet been applied")) {
    warn(
      "DATABASE_URL migrations",
      "Pending migrations — run: npx prisma migrate deploy OR GET /api/cron/migrate"
    )
  } else if (status.status !== 0) {
    warn("DATABASE_URL migrate status", `Could not verify (${status.status ?? "?"})`)
  } else {
    ok("DATABASE_URL configured")
  }
} else {
  warn("DATABASE_URL", "Set locally to verify migrate status")
}

const failed = checks.filter((c) => !c.pass)
const warnings = checks.filter((c) => c.warn)

for (const c of checks) {
  const icon = !c.pass ? "✗" : c.warn ? "!" : "✓"
  console.log(`  ${icon} ${c.label}`)
  if (c.hint) console.log(`      → ${c.hint}`)
}

console.log("\nProd activation (pricing):")
console.log("  1. npm run verify:pricing-ops")
console.log("  2. npm run pricing:ops-playbook")
console.log("  3. Vercel Production → CRON_SECRET, VAPID_*, RESEND_*")
console.log("  4. curl -H \"Authorization: Bearer $CRON_SECRET\" $APP/api/cron/migrate")
console.log("  5. Affilié → /dashboard/affiliate/earnings → activer push marges")

if (failed.length > 0) {
  console.log(`\n[verify-pricing-ops] ${failed.length} blocking check(s).\n`)
  process.exit(1)
}

console.log(
  `\n[verify-pricing-ops] Ready${warnings.length ? ` (${warnings.length} warning(s))` : ""}.\n`
)
