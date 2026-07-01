#!/usr/bin/env node
/**
 * Pre-flight before reactivating the Video Pro paywall on Vercel.
 * Run: npm run verify:video-paywall
 * Prod gate (simulates Vercel env): npm run verify:video-paywall:prod
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
    /* .env.local may be unreadable in CI/sandbox — rely on process.env */
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
    'Set VIDEO_PAYWALL_PAUSED="0" on Vercel Production to enforce 3 free videos + Pro upsell'
  )
}

const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
if (priceId) {
  if (priceId.startsWith("price_")) {
    ok(`STRIPE_PRO_PRICE_ID configured (${priceId.slice(0, 16)}…)`)
  } else {
    fail("STRIPE_PRO_PRICE_ID", "Must start with price_ — Stripe Dashboard → Products → Price ID")
  }
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
  "app/api/stripe/verify-pro/route.ts",
  "app/api/user/quota/route.ts",
  "app/api/generate-video/route.ts",
  "lib/video-quota.ts",
  "lib/video-quota-constants.ts",
  "lib/stripe-pro.ts",
  "lib/video-paywall-return-path.ts",
  "components/GenerateVideoButton.tsx",
  "components/upgrade-toast.tsx",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) {
    ok(`file ${rel}`)
  } else {
    fail(`file ${rel}`, "Missing — paywall wiring incomplete")
  }
}

const webhookPath = resolve(process.cwd(), "lib/stripe-webhook-processor.ts")
if (existsSync(webhookPath)) {
  const webhookSrc = readFileSync(webhookPath, "utf8")
  if (webhookSrc.includes("activateProFromCheckoutSession")) {
    ok("webhook activates Pro on subscription checkout")
  } else {
    fail("webhook Pro activation", "Missing activateProFromCheckoutSession in stripe-webhook-processor.ts")
  }
  if (webhookSrc.includes("customer.subscription.updated")) {
    ok("webhook handles customer.subscription.updated")
  } else {
    fail(
      "webhook subscription.updated",
      "Add customer.subscription.updated handler for Pro cancel / past_due"
    )
  }
  if (webhookSrc.includes("customer.subscription.deleted")) {
    ok("webhook handles customer.subscription.deleted")
  } else {
    fail("webhook subscription.deleted", "Missing Pro deactivation on subscription delete")
  }
} else {
  fail("lib/stripe-webhook-processor.ts", "Missing Stripe webhook processor")
}

const stripeProPath = resolve(process.cwd(), "lib/stripe-pro.ts")
if (existsSync(stripeProPath)) {
  const stripeProSrc = readFileSync(stripeProPath, "utf8")
  if (stripeProSrc.includes("subscriptionHasProPrice")) {
    ok("Pro activation validates STRIPE_PRO_PRICE_ID")
  } else {
    fail("stripe-pro price guard", "Missing subscriptionHasProPrice — any subscription could unlock Pro")
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

console.log("\nOK — Video Pro paywall ready to activate on Vercel.")
console.log("\nVercel Production env:")
console.log('  VIDEO_PAYWALL_PAUSED="0"')
console.log(`  STRIPE_PRO_PRICE_ID="${priceId ?? "price_…"}"`)
console.log("\nStripe webhook events (same endpoint as marketplace):")
console.log("  checkout.session.completed")
console.log("  customer.subscription.updated")
console.log("  customer.subscription.deleted")
console.log("\nSmoke test after deploy:")
console.log("  1. Supplier account → product → generate 3 videos → 402 + Passer Pro")
console.log("  2. Stripe test checkout → verify /api/user/quota returns isPro: true")
