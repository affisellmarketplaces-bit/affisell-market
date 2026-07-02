#!/usr/bin/env node
/**
 * Pre-flight before ROW checkout expansion (pilot / notify / graduate).
 * Run: npm run verify:expansion
 */
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

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
if (stripeSecret) {
  const mode = stripeSecret.startsWith("sk_live_")
    ? "live"
    : stripeSecret.startsWith("sk_test_")
      ? "test"
      : "unknown"
  ok(`STRIPE_SECRET_KEY configured (${mode} mode)`)
  if (mode === "test") {
    warn(
      "Stripe mode",
      "Test keys OK for preview/local pilot — use sk_live_ on Production for real ROW checkout"
    )
  }
} else {
  fail("STRIPE_SECRET_KEY", "Required for checkout after pilot enable")
}

if (process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
  ok("STRIPE_WEBHOOK_SECRET configured")
} else {
  fail("STRIPE_WEBHOOK_SECRET", "Required to record paid orders (first-order → graduation)")
}

const resendKey = process.env.RESEND_API_KEY?.trim()
const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()
if (resendKey && resendFrom) {
  ok(`Resend configured (${resendFrom})`)
} else {
  fail("Resend", "Set RESEND_API_KEY + RESEND_FROM_EMAIL for launch / follow-up / graduation emails")
}

if (process.env.DATABASE_URL?.trim()) {
  ok("DATABASE_URL configured")
} else {
  fail("DATABASE_URL", "Required for waitlist + rollout state")
}

if (process.env.CRON_SECRET?.trim()) {
  ok("CRON_SECRET configured (GitHub Actions → /api/cron/expansion-ops)")
} else {
  warn("CRON_SECRET", "Set on Vercel + GitHub secrets for automated notify batches")
}

const marketRegion = (process.env.NEXT_PUBLIC_MARKET_REGION ?? "eu").toLowerCase()
ok(`Market region: ${marketRegion === "us" ? "us" : "eu"}`)

if (process.env.EXPANSION_AUTO_PILOT_ON_FIRST_ORDER === "1") {
  ok("EXPANSION_AUTO_PILOT_ON_FIRST_ORDER=1 (next country after first order)")
} else {
  warn(
    "Auto-pilot",
    "Optional: EXPANSION_AUTO_PILOT_ON_FIRST_ORDER=1 to chain pilots after first paid order"
  )
}

for (const rel of [
  "lib/admin/expansion-pilot.ts",
  "app/api/cron/expansion-ops/route.ts",
  "app/admin/expansion/page.tsx",
  "components/admin/admin-expansion-console.tsx",
  "lib/checkout-country-rollout.ts",
  "scripts/expansion-pilot.ts",
  "scripts/expansion-status.ts",
]) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing")
}

const failed = checks.filter((c) => !c.pass)
const warnings = checks.filter((c) => c.warn)

console.log("\n[verify-expansion] Pre-flight\n")
for (const c of checks) {
  const icon = !c.pass ? "✗" : c.warn ? "!" : "✓"
  console.log(`  ${icon} ${c.label}`)
  if (c.hint) console.log(`      → ${c.hint}`)
}

console.log("\nNext steps:")
console.log("  1. npm run expansion:status")
console.log("  2. npm run expansion:pilot              # top waitlist country + launch emails")
console.log("  3. npm run expansion:pilot -- --no-notify --country=XX   # enable only")
console.log("  4. Monitor /admin/expansion + Metabase [expansion-rollout]")

if (failed.length > 0) {
  console.log(`\n[verify-expansion] ${failed.length} blocking check(s) — fix before pilot.\n`)
  process.exit(1)
}

console.log(
  `\n[verify-expansion] Ready${warnings.length ? ` (${warnings.length} warning(s))` : ""}.\n`
)
