#!/usr/bin/env node
/**
 * Founder playbook — affiliate pricing ops smoke tests & prod checklist.
 * Run: npm run pricing:ops-playbook
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
    /* ignore */
  }
}

loadDotEnv(resolve(process.cwd(), ".env.local"))
loadDotEnv(resolve(process.cwd(), ".env"))

const appUrl =
  process.env.VERCEL_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://affisell.com"
const base = appUrl.replace(/\/$/, "")
const cronSecret = process.env.CRON_SECRET?.trim()
const hasVapid = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim()
)
const hasResend = Boolean(
  process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()
)

console.log("\n[pricing-ops-playbook] Affiliate pricing — prod checklist\n")
console.log(`  App URL     : ${base}`)
console.log(`  CRON_SECRET : ${cronSecret ? "✓ set" : "✗ missing — GitHub + Vercel"}`)
console.log(`  VAPID       : ${hasVapid ? "✓ set" : "✗ missing — affiliate push disabled"}`)
console.log(`  Resend      : ${hasResend ? "✓ set" : "✗ missing — wholesale emails skipped"}`)

console.log("\n── Migrations (prod DB) ──")
console.log("  • 20260703140000_affiliate_variant_pricing")
console.log("  • 20260704100000_affiliate_pricing_auto_adjust")
console.log("  • 20260704143000_affiliate_margin_review")
if (cronSecret) {
  console.log("\n  curl -fsS -H \"Authorization: Bearer $CRON_SECRET\" \\")
  console.log(`    "${base}/api/cron/migrate"`)
} else {
  console.log("\n  npx prisma migrate deploy   # with prod DATABASE_URL")
}

console.log("\n── Crons (GitHub Actions daily 09:00 UTC) ──")
console.log("  • GET /api/cron/adjust-variant-pricing  — AI ±5% on pricingAutoAdjust listings")
console.log("  • GET /api/cron/migrate                 — schema deploy")
if (cronSecret) {
  console.log("\n  curl -fsS -H \"Authorization: Bearer $CRON_SECRET\" \\")
  console.log(`    "${base}/api/cron/adjust-variant-pricing"`)
}

console.log("\n── Event-driven (no cron) ──")
console.log("  • Supplier PUT/PATCH product → wholesale diff → inbox + email + push")
console.log("  • Affiliate PATCH margins    → clears marginReviewNeeded")

console.log("\n── Manual smoke (founder) ──")
console.log("  1. Affilié : listing multi-SKU → marges par variante → publish")
console.log("  2. /dashboard/affiliate/earnings → activer push + voir analytics")
console.log("  3. Fournisseur : monter basePriceCents ou SKU wholesale")
console.log("  4. Affilié : badge « Marge à revoir » + push + email")
console.log("  5. Affilié : Apply AI to variants → save → badge cleared")

console.log("\n── Unit tests (CI) ──")
console.log("  npm test -- lib/__tests__/affiliate-variant-pricing.test.ts")
console.log("  npm test -- lib/__tests__/affiliate-wholesale-change-guard.test.ts")
console.log("  npm test -- lib/__tests__/affiliate-variant-margin-analytics.test.ts")
console.log("  npm test -- lib/__tests__/affiliate-wholesale-change-push.test.ts")
console.log("  npm test -- lib/__tests__/affiliate-margin-auto-fix.test.ts")

console.log("\n── Preflight bundle ──")
console.log("  npm run verify:pricing-ops && npm run verify:web-push && npm run verify:ops")
console.log("")
