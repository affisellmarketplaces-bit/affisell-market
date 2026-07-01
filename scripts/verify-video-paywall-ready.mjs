#!/usr/bin/env node
/**
 * Pre-flight before reactivating the Video Pro paywall on Vercel.
 * Run: npm run verify:video-paywall
 *
 * Expects VIDEO_PAYWALL_PAUSED=0 and STRIPE_PRO_PRICE_ID in .env.local (or env).
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadDotEnv(path) {
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
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv(resolve(process.cwd(), "prisma/env.local"))
loadDotEnv(resolve(process.cwd(), ".env.local"))

const checks = []

function ok(label) {
  checks.push({ label, pass: true })
}

function fail(label, hint) {
  checks.push({ label, pass: false, hint })
}

const pausedRaw = process.env.VIDEO_PAYWALL_PAUSED?.trim().toLowerCase()
const paywallActive =
  pausedRaw === "0" || pausedRaw === "false" || pausedRaw === "no"

if (paywallActive) {
  ok("VIDEO_PAYWALL_PAUSED=0 (paywall actif)")
} else {
  fail(
    "VIDEO_PAYWALL_PAUSED",
    'Set VIDEO_PAYWALL_PAUSED="0" on Vercel to enforce 3 free videos + Pro upsell'
  )
}

const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
if (priceId) {
  ok(`STRIPE_PRO_PRICE_ID configured (${priceId.slice(0, 12)}…)`)
} else {
  fail("STRIPE_PRO_PRICE_ID", "Stripe Dashboard → Products → copy Price ID (price_…)")
}

const disabledRaw = process.env.VIDEO_PAYWALL_DISABLED?.trim().toLowerCase()
if (disabledRaw === "1" || disabledRaw === "true" || disabledRaw === "yes") {
  fail(
    "VIDEO_PAYWALL_DISABLED",
    "Remove VIDEO_PAYWALL_DISABLED or set to 0 — it bypasses the free tier when pause is off"
  )
} else {
  ok("VIDEO_PAYWALL_DISABLED not bypassing")
}

const requiredFiles = [
  "app/api/stripe/create-checkout/route.ts",
  "app/api/user/quota/route.ts",
  "lib/video-quota.ts",
  "lib/video-paywall-return-path.ts",
  "components/GenerateVideoButton.tsx",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) {
    ok(`file ${rel}`)
  } else {
    fail(`file ${rel}`, "Missing — paywall wiring incomplete")
  }
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed. Fix before setting VIDEO_PAYWALL_PAUSED=0 in prod.`)
  process.exit(1)
}

console.log("\nOK — Video Pro paywall ready to activate (VIDEO_PAYWALL_PAUSED=0).")
