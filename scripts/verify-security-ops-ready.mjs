#!/usr/bin/env node
/**
 * Production security ops — Redis + webhook/cron secrets.
 * Run: npm run verify:security-ops
 *
 * Does not print secret values — only SET / MISSING / format hints.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { randomBytes } from "node:crypto"

function loadDotEnv(path, { override = false } = {}) {
  if (!existsSync(path)) return
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
    if (override || process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv(resolve(process.cwd(), ".env"))
loadDotEnv(resolve(process.cwd(), ".env.local"), { override: true })

const checks = []
const pass = (label, detail) => checks.push({ ok: true, label, detail })
const fail = (label, detail) => checks.push({ ok: false, label, detail })
const warn = (label, detail) => checks.push({ ok: null, label, detail })

// --- Redis (distributed rate limits on Vercel) ---
const redis = process.env.REDIS_URL?.trim() ?? ""
if (redis && /^rediss?:\/\//i.test(redis)) {
  pass("REDIS_URL", "configured (distributed rate limits + queues)")
} else if (redis) {
  warn("REDIS_URL", "set but not redis:// or rediss:// — check format")
} else {
  fail(
    "REDIS_URL",
    "Missing — Upstash Redis (rediss://…) on Vercel Production. Without it, checkout/auth rate limits are per-instance only."
  )
}

// --- Stripe webhook ---
const stripeWh = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? ""
if (stripeWh.startsWith("whsec_")) {
  pass("STRIPE_WEBHOOK_SECRET", "whsec_… present")
} else if (stripeWh) {
  warn("STRIPE_WEBHOOK_SECRET", "set but does not start with whsec_ — confirm Stripe Dashboard → Webhooks")
} else {
  fail(
    "STRIPE_WEBHOOK_SECRET",
    "Missing — Stripe Dashboard → Developers → Webhooks → endpoint …/api/webhooks/stripe → Signing secret"
  )
}

// --- AutoDS webhook ---
const autodsWh = process.env.AUTODS_WEBHOOK_SECRET?.trim() ?? ""
if (autodsWh) {
  pass("AUTODS_WEBHOOK_SECRET", "configured (prod rejects unsigned)")
} else {
  warn(
    "AUTODS_WEBHOOK_SECRET",
    "Unset — OK if AutoDS unused; Production will 503 /api/webhooks/autods without it"
  )
}

// --- AfterShip (optional) ---
const aftership =
  process.env.AFTERSHIP_WEBHOOK_SECRET?.trim() ||
  process.env.AFTIRSHIP_WEBHOOK_SECRET?.trim() ||
  ""
if (aftership) {
  pass("AFTERSHIP_WEBHOOK_SECRET", "configured")
} else {
  warn("AFTERSHIP_WEBHOOK_SECRET", "Unset — tracking webhooks soft-skip in non-prod; set before relying on AfterShip")
}

// --- Cron ---
const cron = process.env.CRON_SECRET?.trim() ?? ""
if (cron && cron.length >= 24) {
  pass("CRON_SECRET", `configured (len≥24)`)
} else if (cron) {
  warn("CRON_SECRET", "too short — use ≥32 random bytes (hex/base64)")
} else {
  fail(
    "CRON_SECRET",
    "Missing — same value on Vercel Production + GitHub Actions secrets for /api/cron/*"
  )
}

// --- Stripe key mode hint ---
const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
if (stripeKey.startsWith("sk_live_")) {
  pass("STRIPE_SECRET_KEY", "live mode")
} else if (stripeKey.startsWith("sk_test_")) {
  warn("STRIPE_SECRET_KEY", "test mode — fine for local/preview; Production checkout needs sk_live_")
} else if (stripeKey) {
  warn("STRIPE_SECRET_KEY", "unexpected format")
} else {
  fail("STRIPE_SECRET_KEY", "Missing")
}

console.log("\nAffisell security ops checklist\n")
let failed = 0
for (const c of checks) {
  const mark = c.ok === true ? "✓" : c.ok === false ? "✗" : "!"
  if (c.ok === false) failed += 1
  console.log(`  ${mark} ${c.label}`)
  console.log(`    ${c.detail}`)
}

console.log("\n── Vercel Production (Dashboard) ──")
console.log("  1. Upstash → Create Redis → copy REDIS_URL (rediss://…)")
console.log("  2. Vercel → Project → Settings → Environment Variables → Production:")
console.log("       REDIS_URL, STRIPE_WEBHOOK_SECRET, CRON_SECRET")
console.log("       (+ AUTODS_WEBHOOK_SECRET / AFTERSHIP_WEBHOOK_SECRET if used)")
console.log("  3. Stripe → Webhooks → https://YOUR_DOMAIN/api/webhooks/stripe")
console.log("       events: checkout.session.completed, payment_intent.*, charge.refunded, …")
console.log("  4. GitHub → Settings → Secrets → CRON_SECRET (same as Vercel)")
console.log("  5. Redeploy Production after env changes")

if (!cron) {
  const sample = randomBytes(32).toString("base64url")
  console.log("\n── Suggested CRON_SECRET (generate once, store in Vercel + GitHub) ──")
  console.log(`  ${sample}`)
}

console.log("\n── Pentest (when traffic grows) ──")
console.log("  • OWASP ASVS L2 checklist on auth, checkout, uploads, webhooks")
console.log("  • Or hire a EU pentester / bug bounty (Intigriti / YesWeHack)")
console.log("")

if (failed > 0) {
  console.error(`[verify:security-ops] ${failed} required item(s) missing`)
  process.exit(1)
}

console.log("[verify:security-ops] OK — required secrets present locally")
process.exit(0)
