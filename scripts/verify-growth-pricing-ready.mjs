#!/usr/bin/env node
/**
 * Pre-flight before relying on Growth plan billing (Lanceur/Dominator/Empire) in production.
 * Run: npm run verify:growth-pricing
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

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
if (stripeSecret) {
  ok("STRIPE_SECRET_KEY configured")
} else {
  fail("STRIPE_SECRET_KEY", "Required — Growth prices self-heal via lib/stripe-growth-ensure.ts, but need Stripe API access to do it")
}

const priceEnvVars = [
  "STRIPE_GROWTH_LANCEUR_MONTHLY_PRICE_ID",
  "STRIPE_GROWTH_LANCEUR_ANNUAL_PRICE_ID",
  "STRIPE_GROWTH_DOMINATOR_MONTHLY_PRICE_ID",
  "STRIPE_GROWTH_DOMINATOR_ANNUAL_PRICE_ID",
  "STRIPE_GROWTH_EMPIRE_MONTHLY_PRICE_ID",
  "STRIPE_GROWTH_EMPIRE_ANNUAL_PRICE_ID",
]
const configuredPriceVars = priceEnvVars.filter((name) => process.env[name]?.trim())
if (configuredPriceVars.length === priceEnvVars.length) {
  ok("All 6 Growth price env vars configured")
} else if (configuredPriceVars.length > 0) {
  ok(`${configuredPriceVars.length}/6 Growth price env vars configured (rest will auto-provision)`)
} else {
  ok("No Growth price env vars set — all 6 prices will auto-provision on first checkout (fine for staging; glance at Stripe Dashboard before go-live)")
}

const requiredFiles = [
  "lib/growth-pricing-tiers.ts",
  "lib/stripe-growth.ts",
  "lib/stripe-growth-ensure.ts",
  "app/api/stripe/create-growth-checkout/route.ts",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) {
    ok(`file ${rel}`)
  } else {
    fail(`file ${rel}`, "Missing — Growth billing wiring incomplete")
  }
}

const webhookPath = resolve(process.cwd(), "lib/stripe-webhook-processor.ts")
if (existsSync(webhookPath)) {
  const webhookSrc = readFileSync(webhookPath, "utf8")
  if (webhookSrc.includes("activateGrowthFromCheckoutSession")) {
    ok("webhook activates Growth plan on subscription checkout")
  } else {
    fail("webhook Growth activation", "Missing activateGrowthFromCheckoutSession in stripe-webhook-processor.ts")
  }
  if (webhookSrc.includes("syncGrowthFromSubscription")) {
    ok("webhook handles customer.subscription.updated for Growth")
  } else {
    fail("webhook subscription.updated", "Missing syncGrowthFromSubscription — Growth cancel/past_due won't sync")
  }
  if (webhookSrc.includes("deactivateGrowthFromSubscription")) {
    ok("webhook handles customer.subscription.deleted for Growth")
  } else {
    fail("webhook subscription.deleted", "Missing deactivateGrowthFromSubscription")
  }
} else {
  fail("lib/stripe-webhook-processor.ts", "Missing Stripe webhook processor")
}

const stripeGrowthPath = resolve(process.cwd(), "lib/stripe-growth.ts")
if (existsSync(stripeGrowthPath)) {
  const src = readFileSync(stripeGrowthPath, "utf8")
  if (src.includes("subscriptionHasGrowthPrice")) {
    ok("Growth activation validates the subscription actually carries a Growth price")
  } else {
    fail("stripe-growth price guard", "Missing subscriptionHasGrowthPrice — any subscription could unlock a Growth tier")
  }
}

const radarPlansPath = resolve(process.cwd(), "lib/radar/plans.ts")
if (existsSync(radarPlansPath)) {
  const src = readFileSync(radarPlansPath, "utf8")
  if (src.includes("growthPlanFloor")) {
    ok("Dominator/Empire bundle a Radar plan floor (pro/global)")
  } else {
    fail("Radar bundling", "Missing growthPlanFloor in lib/radar/plans.ts — Phase 2 not shipped yet")
  }
}

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
if (existsSync(schemaPath)) {
  const src = readFileSync(schemaPath, "utf8")
  if (src.includes("growthPlan ") && src.includes("growthStripeSubscriptionId")) {
    ok("Prisma schema has growthPlan / growthStripeSubscriptionId fields")
  } else {
    fail("Prisma schema", "Missing growthPlan fields on User — run the migration first")
  }
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed. Fix before relying on Growth billing in prod.`)
  process.exit(1)
}

console.log("\nOK — Growth plan billing wiring looks complete.")
console.log("\nStripe webhook events (same endpoint as marketplace/Radar/Pro):")
console.log("  checkout.session.completed")
console.log("  customer.subscription.updated")
console.log("  customer.subscription.deleted")
console.log("\nSmoke test after deploy:")
console.log("  1. Stripe test checkout for each of Lanceur/Dominator/Empire (monthly + annual) → verify User.growthPlan updates")
console.log("  2. Dominator/Empire checkout → verify the user's resolved Radar plan is at least pro/global")
console.log("  3. Cancel (customer.subscription.deleted test event) → verify growthPlan resets to \"none\"")
