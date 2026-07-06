#!/usr/bin/env node
/**
 * Founder playbook — LTV loop prod activation & smoke curls.
 * Run: npm run ltv:ops-playbook
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

function curl(path) {
  if (!cronSecret) {
    console.log(`  # curl -fsS -H "Authorization: Bearer $CRON_SECRET" "${base}${path}"`)
    return
  }
  console.log(`  curl -fsS -H "Authorization: Bearer ${cronSecret.slice(0, 4)}…" \\`)
  console.log(`    "${base}${path}"`)
}

console.log("\n[ltv-ops-playbook] LTV loop — prod activation checklist\n")
console.log(`  App URL     : ${base}`)
console.log(`  CRON_SECRET : ${cronSecret ? "✓ set" : "✗ missing — GitHub + Vercel"}`)
console.log(`  VAPID       : ${hasVapid ? "✓ set" : "✗ missing — cart + wishlist push disabled"}`)
console.log(`  Resend      : ${hasResend ? "✓ set" : "✗ missing — recovery emails skipped"}`)

console.log("\n── Migrations (prod DB) ──")
console.log("  • 20260705193000_store_newsletter_subscriber")
console.log("  • 20260705203000_order_repurchase_reminder_sent_at")
console.log("  • 20260705213000_cart_abandonment_email_sent_at")
console.log("  • 20260706203000_order_review_early_nudge_sent_at")
console.log("  • 20260706210000_store_newsletter_flash_sale_alert_key")
console.log("\n  Deploy schema:")
curl("/api/cron/migrate")

console.log("\n── Crons (GitHub Actions) ──")
console.log("  Frequent (every 30 min):")
console.log("    • GET /api/cron/abandoned-cart  — email + push recovery (1h idle)")
curl("/api/cron/abandoned-cart")

console.log("\n  Daily (09:00 UTC):")
console.log("    • GET /api/cron/review-early-nudge   — J+3 review push")
console.log("    • GET /api/cron/review-reminder      — J+7 review email")
console.log("    • GET /api/cron/repurchase-reminder  — J+30 win-back")
console.log("    • GET /api/cron/wishlist-price-alerts — price drop email + push")
curl("/api/cron/review-early-nudge")
curl("/api/cron/wishlist-price-alerts")

console.log("\n── Event-driven (no cron) ──")
console.log("  • Brand Studio save + flash sale active → newsletter blast (StoreNewsletterSubscriber)")
console.log("  • POST /api/store/newsletter/subscribe — storefront opt-in + welcome email")
console.log("  • GET /api/affiliate/opportunity-pulse — hot SKU rail (affiliate catalog)")

console.log("\n── Manual smoke (founder) ──")
console.log("  1. Buyer: add to cart → wait 1h (or lower hours in cron dev) → recovery email/push")
console.log("  2. Buyer: wishlist + target price → cron wishlist-price-alerts")
console.log("  3. Buyer: delivered order → review-early-nudge + review-reminder")
console.log("  4. Storefront: newsletter subscribe → welcome email")
console.log("  5. Brand Studio: publish flash sale → subscriber alert email")
console.log("  6. Affiliate: /dashboard/affiliate/catalog → Opportunity Pulse rail")

console.log("\n── Preflight ──")
console.log("  npm run verify:ltv-ops")
console.log("  npm run verify:web-push")
console.log("  npm run verify:ops\n")

if (!cronSecret || !hasVapid || !hasResend) {
  console.log("[ltv-ops-playbook] Set missing env on Vercel Production + redeploy.\n")
  process.exit(1)
}

console.log("[ltv-ops-playbook] Env OK — run curls above after deploy.\n")
