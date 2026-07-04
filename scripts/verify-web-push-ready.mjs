#!/usr/bin/env node
/**
 * Pre-flight before enabling Web Push in production (Vercel).
 * Run: npm run verify:web-push
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

const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()

if (publicKey && privateKey) {
  ok(`VAPID keys configured (${publicKey.slice(0, 12)}…)`)
  if (publicKey.length < 80) {
    fail("VAPID public key length", "Key looks too short — regenerate with npx web-push generate-vapid-keys")
  } else {
    ok("VAPID public key length OK")
  }
} else {
  fail(
    "VAPID keys",
    "Run: npx web-push generate-vapid-keys → set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY on Vercel"
  )
}

const subject =
  process.env.VAPID_SUBJECT?.trim() ||
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "mailto:support@affisell.com"
if (subject.startsWith("mailto:") || subject.startsWith("https://")) {
  ok(`VAPID subject (${subject.slice(0, 32)}…)`)
} else {
  fail("VAPID_SUBJECT", 'Set VAPID_SUBJECT="mailto:support@affisell.com" (or https://…)')
}

const requiredFiles = [
  "public/sw.js",
  "app/api/push/subscribe/route.ts",
  "lib/web-push-send.ts",
  "lib/web-push-config.ts",
  "lib/order-status-push.ts",
  "lib/order-status-push-shared.ts",
  "lib/emails/notify-order-shipped.ts",
  "lib/emails/notify-order-delivered.ts",
  "app/api/cron/wishlist-price-alerts/route.ts",
  "lib/affiliate-wholesale-change-push.ts",
  "lib/affiliate-wholesale-change-notify.ts",
  "components/affiliate/affiliate-push-notifications-card.tsx",
  "components/push/request-price-alert-push.ts",
  "prisma/migrations/20260630140000_push_subscription/migration.sql",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing — Web Push wiring incomplete")
}

const swPath = resolve(process.cwd(), "public/sw.js")
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf8")
  if (sw.includes("payload.tag")) ok("service worker uses dynamic notification tag")
  else fail("public/sw.js tag", "Push payload must pass tag for order vs price alerts")
  if (sw.includes("self.location.origin")) ok("service worker resolves relative click URLs")
  else fail("public/sw.js click URL", "notificationclick must resolve relative paths to absolute URLs")
}

const pushSendPath = resolve(process.cwd(), "lib/web-push-send.ts")
if (existsSync(pushSendPath)) {
  const src = readFileSync(pushSendPath, "utf8")
  if (src.includes("tag: payload.tag")) ok("web-push payload includes tag")
  else fail("lib/web-push-send.ts", "Include tag in push JSON for service worker")
  if (src.includes("affisell-order-shipped")) ok("order shipped push tag wired")
  else fail("order shipped push", "Missing shipped notification tag in web-push-send.ts")
  if (src.includes("affisell-wholesale-")) ok("wholesale margin push tag wired")
  else fail("wholesale push", "Missing affisell-wholesale tag in web-push-send.ts")
}

const shippedPath = resolve(process.cwd(), "lib/emails/notify-order-shipped.ts")
if (existsSync(shippedPath)) {
  const src = readFileSync(shippedPath, "utf8")
  if (src.includes("buyerUserId")) ok("shipped email passes buyerUserId to push")
  else fail("notify-order-shipped", "Pass buyerUserId for reliable push delivery")
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log("\nOK — Web Push ready for production.")
console.log("\nVercel Production env:")
console.log('  NEXT_PUBLIC_VAPID_PUBLIC_KEY="…"')
console.log('  VAPID_PRIVATE_KEY="…"')
console.log('  VAPID_SUBJECT="mailto:support@affisell.com"')
console.log("\nDatabase:")
console.log("  npx prisma migrate deploy   # PushSubscription table")
console.log("\nCron (already on Vercel):")
console.log("  GET /api/cron/wishlist-price-alerts  (Bearer CRON_SECRET)")
console.log("\nSmoke test after deploy:")
console.log("  1. /marketplace/account → Activer les notifications (buyer)")
console.log("  2. /dashboard/affiliate/earnings → Activer alertes push marges (affilié)")
console.log("  3. Supplier wholesale increase OR order shipped → push on device")
