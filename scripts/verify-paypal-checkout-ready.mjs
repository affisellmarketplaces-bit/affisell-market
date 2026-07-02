#!/usr/bin/env node
/**
 * Pre-flight before enabling PayPal on marketplace Stripe Checkout (prod).
 * Run: npm run verify:paypal
 * Prod gate: npm run verify:paypal:prod
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

const paypalEnabled = process.env.MARKETPLACE_PAYPAL_ENABLED?.trim() === "1"
if (paypalEnabled) {
  ok("MARKETPLACE_PAYPAL_ENABLED=1")
} else {
  fail(
    "MARKETPLACE_PAYPAL_ENABLED",
    'Set MARKETPLACE_PAYPAL_ENABLED="1" on Vercel Production after Stripe Dashboard enables PayPal'
  )
}

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
if (stripeSecret?.startsWith("sk_")) {
  ok(`STRIPE_SECRET_KEY configured (${stripeSecret.slice(0, 8)}…)`)
} else {
  fail("STRIPE_SECRET_KEY", "Required for Stripe Checkout with PayPal")
}

const requiredFiles = [
  "lib/marketplace-checkout-payment-methods.ts",
  "lib/marketplace-checkout.ts",
  "lib/payment-method-brands.ts",
  "components/checkout/payment-methods-strip.tsx",
  "components/checkout/payment-method-brand-icons.tsx",
  "lib/stripe-webhook-processor.ts",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing")
}

const methodsPath = resolve(process.cwd(), "lib/marketplace-checkout-payment-methods.ts")
if (existsSync(methodsPath)) {
  const src = readFileSync(methodsPath, "utf8")
  if (src.includes("isMarketplacePaypalEnabled")) ok("PayPal opt-in helper")
  else fail("PayPal helper", "Missing isMarketplacePaypalEnabled")
  if (src.includes("marketplaceCheckoutPaymentSessionOptionsForAmount")) {
    ok("amount-aware checkout payment methods")
  } else {
    fail("checkout options", "Missing marketplaceCheckoutPaymentSessionOptionsForAmount")
  }
}

const checkoutPath = resolve(process.cwd(), "lib/marketplace-checkout.ts")
if (existsSync(checkoutPath)) {
  const src = readFileSync(checkoutPath, "utf8")
  if (src.includes("marketplaceCheckoutPaymentSessionOptionsForAmount")) {
    ok("marketplace checkout uses amount-aware payment methods")
  } else {
    fail("marketplace-checkout.ts", "Wire PayPal/Klarna via marketplaceCheckoutPaymentSessionOptionsForAmount")
  }
  if (src.includes("paymentMethodTypes")) ok("checkout logs paymentMethodTypes")
  else fail("checkout logs", "Add paymentMethodTypes to [checkout] business logs")
}

const brandsPath = resolve(process.cwd(), "lib/payment-method-brands.ts")
if (existsSync(brandsPath)) {
  const src = readFileSync(brandsPath, "utf8")
  if (src.includes("isMarketplacePaypalEnabled")) ok("footer badges gated on PayPal env")
  else fail("payment-method-brands", "PayPal badge must follow MARKETPLACE_PAYPAL_ENABLED")
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log("\nOK — PayPal checkout ready for production.")
console.log("\nStripe Dashboard (before Vercel env):")
console.log("  Settings → Payment methods → enable PayPal")
console.log("  Connect: PayPal payouts follow existing Stripe Connect settlement (no separate PayPal merchant onboarding in Affisell)")
console.log("\nVercel Production env:")
console.log('  MARKETPLACE_PAYPAL_ENABLED="1"')
console.log("\nSmoke test after deploy:")
console.log("  1. Marketplace listing ≥ €0.50 → Stripe Checkout shows PayPal tab")
console.log("  2. Pay with PayPal (test) → webhook checkout.session.completed → order paid")
