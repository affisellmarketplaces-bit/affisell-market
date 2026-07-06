#!/usr/bin/env node
/**
 * LTV loop pre-flight — migrations, crons, push/email wiring (LTV 1–7).
 * Run: npm run verify:ltv-ops
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

function fileExists(rel) {
  return existsSync(resolve(root, rel))
}

const schema = read("prisma/schema.prisma") ?? ""

const schemaFields = [
  ["Order.reviewEarlyNudgeSentAt", "reviewEarlyNudgeSentAt"],
  ["Order.repurchaseReminderSentAt", "repurchaseReminderSentAt"],
  ["Cart.cartAbandonmentEmailSentAt", "cartAbandonmentEmailSentAt"],
  ["StoreNewsletterSubscriber", "model StoreNewsletterSubscriber"],
  ["StoreNewsletterSubscriber.lastFlashSaleAlertKey", "lastFlashSaleAlertKey"],
]
for (const [label, needle] of schemaFields) {
  if (schema.includes(needle)) ok(`Prisma schema: ${label}`)
  else fail(`Prisma schema: ${label}`, `Missing ${needle}`)
}

const migrations = [
  ["20260706203000 review early nudge", "prisma/migrations/20260706203000_order_review_early_nudge_sent_at/migration.sql", "reviewEarlyNudgeSentAt"],
  ["20260705203000 repurchase reminder", "prisma/migrations/20260705203000_order_repurchase_reminder_sent_at/migration.sql", "repurchaseReminderSentAt"],
  ["20260705213000 cart abandonment", "prisma/migrations/20260705213000_cart_abandonment_email_sent_at/migration.sql", "cartAbandonmentEmailSentAt"],
  ["20260705193000 store newsletter", "prisma/migrations/20260705193000_store_newsletter_subscriber/migration.sql", "StoreNewsletterSubscriber"],
  ["20260706210000 flash sale alert key", "prisma/migrations/20260706210000_store_newsletter_flash_sale_alert_key/migration.sql", "lastFlashSaleAlertKey"],
]
for (const [label, path, needle] of migrations) {
  const sql = read(path)
  if (sql?.includes(needle)) ok(`Migration ${label}`)
  else fail(`Migration ${label}`, `Missing or invalid ${path}`)
}

const cronRoutes = [
  "app/api/cron/migrate/route.ts",
  "app/api/cron/review-early-nudge/route.ts",
  "app/api/cron/review-reminder/route.ts",
  "app/api/cron/repurchase-reminder/route.ts",
  "app/api/cron/wishlist-price-alerts/route.ts",
  "app/api/cron/abandoned-cart/route.ts",
]
for (const route of cronRoutes) {
  if (fileExists(route)) ok(`Cron route ${route}`)
  else fail(`Cron route ${route}`, "Missing LTV cron route")
}

const libModules = [
  "lib/cron/review-early-nudge.ts",
  "lib/cron/review-reminder.ts",
  "lib/cron/repurchase-reminder.ts",
  "lib/cron/abandoned-cart-reminder.ts",
  "lib/order-review-push.ts",
  "lib/web-push-send.ts",
  "lib/store-newsletter-subscribe.ts",
  "lib/store-flash-sale-newsletter.ts",
  "lib/affiliate-catalog-opportunity-pulse.ts",
  "app/api/affiliate/opportunity-pulse/route.ts",
  "app/api/store/newsletter/subscribe/route.ts",
]
for (const mod of libModules) {
  if (fileExists(mod)) ok(`Module ${mod}`)
  else fail(`Module ${mod}`, "Missing LTV lib/API module")
}

const webPush = read("lib/web-push-send.ts") ?? ""
if (webPush.includes("sendAbandonedCartPushToUser")) {
  ok("Web Push: sendAbandonedCartPushToUser")
} else {
  fail("Web Push", "Missing sendAbandonedCartPushToUser in lib/web-push-send.ts")
}
if (webPush.includes("sendPriceDropPushToUser")) {
  ok("Web Push: sendPriceDropPushToUser")
} else {
  fail("Web Push", "Missing sendPriceDropPushToUser")
}

const workflow = read(".github/workflows/scheduled-crons.yml") ?? ""
const frequentCrons = ["/api/cron/abandoned-cart"]
const dailyCrons = [
  "/api/cron/migrate",
  "/api/cron/review-early-nudge",
  "/api/cron/review-reminder",
  "/api/cron/repurchase-reminder",
  "/api/cron/wishlist-price-alerts",
]
if (workflow) {
  for (const path of frequentCrons) {
    if (workflow.includes(path)) ok(`scheduled-crons frequent includes ${path}`)
    else fail("scheduled-crons.yml", `Missing ${path} in frequent job`)
  }
  for (const path of dailyCrons) {
    if (workflow.includes(path)) ok(`scheduled-crons daily includes ${path}`)
    else fail("scheduled-crons.yml", `Missing ${path} in daily job`)
  }
} else {
  fail("scheduled-crons.yml", "Workflow file missing")
}

const failed = checks.filter((c) => !c.pass)
console.log("\n[verify-ltv-ops] LTV loop — migrations, crons, modules (LTV 1–7)\n")
for (const c of checks) {
  const icon = c.pass ? "✓" : "✗"
  console.log(`  ${icon} ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.log(`\n[verify-ltv-ops] ${failed.length} check(s) failed.\n`)
  process.exit(1)
}

console.log("\n[verify-ltv-ops] Ready — prod activation:\n")
console.log("  npm run ltv:ops-playbook")
console.log("  npm run verify:web-push    # VAPID keys for cart + wishlist push")
console.log("\n  curl -H \"Authorization: Bearer $CRON_SECRET\" \"$VERCEL_APP_URL/api/cron/migrate\"")
console.log("  curl -H \"Authorization: Bearer $CRON_SECRET\" \"$VERCEL_APP_URL/api/cron/abandoned-cart\"")
console.log("  curl -H \"Authorization: Bearer $CRON_SECRET\" \"$VERCEL_APP_URL/api/cron/wishlist-price-alerts\"\n")
