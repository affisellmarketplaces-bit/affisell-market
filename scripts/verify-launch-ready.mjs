#!/usr/bin/env node
/**
 * Launch ops checklist — Stripe CGV consent, médiateur, Vercel domain SSL.
 * Run: npm run verify:launch
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createRequire } from "node:module"

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

loadDotEnv(resolve(process.cwd(), ".env"))
loadDotEnv(resolve(process.cwd(), ".env.local"))

const require = createRequire(import.meta.url)

const checks = []
const pass = (label, detail) => checks.push({ ok: true, label, detail })
const fail = (label, detail) => checks.push({ ok: false, label, detail })
const warn = (label, detail) => checks.push({ ok: null, label, detail })

function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  return raw.replace(/\/$/, "")
}

const tosUrl = `${appOrigin()}/legal/cgv`

// --- Legal / tax ---
const address =
  process.env.COMPANY_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() ||
  ""
if (address && !/à compléter/i.test(address)) {
  pass("COMPANY_ADDRESS", address)
} else {
  fail("COMPANY_ADDRESS", "Set siège réel (Vercel Production + local)")
}

const tax = (process.env.STRIPE_AUTOMATIC_TAX ?? "").trim().toLowerCase()
if (tax === "0" || tax === "false" || tax === "off" || tax === "") {
  pass("STRIPE_AUTOMATIC_TAX", tax || "(unset → franchise off)")
} else {
  fail("STRIPE_AUTOMATIC_TAX", `Expected 0 for art. 293 B, got ${tax}`)
}

// --- Médiateur ---
const mediator =
  process.env.MEDIATOR_NAME?.trim() ||
  process.env.AFFISELL_MEDIATOR_NAME?.trim() ||
  "CM2C (default)"
const mediatorConfirmed = process.env.MEDIATOR_MEMBERSHIP_CONFIRMED?.trim()
if (mediatorConfirmed === "1" || mediatorConfirmed === "true") {
  pass("Médiateur L.612-1", `${mediator} — membership confirmed`)
} else {
  warn(
    "Médiateur L.612-1",
    `${mediator} — set MEDIATOR_MEMBERSHIP_CONFIRMED=1 after real CM2C (or other) membership, or change MEDIATOR_NAME/URL`
  )
}

// --- Vercel store domains ---
const vercelToken = process.env.VERCEL_API_TOKEN?.trim()
const vercelProject = process.env.VERCEL_PROJECT_ID?.trim()
if (vercelToken && vercelProject) {
  pass("Vercel domain SSL API", `project ${vercelProject.slice(0, 8)}…`)
} else {
  fail(
    "Vercel domain SSL API",
    "Missing VERCEL_API_TOKEN and/or VERCEL_PROJECT_ID — https://vercel.com/account/tokens + Project Settings → General"
  )
}

// --- Stripe CGV consent (live probe) ---
async function probeStripeCgvConsent() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    fail("Stripe CGV consent", "STRIPE_SECRET_KEY missing")
    return
  }

  let Stripe
  try {
    Stripe = require("stripe").default || require("stripe")
  } catch {
    fail("Stripe CGV consent", "stripe package not found")
    return
  }

  const stripe = new Stripe(key)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: 100,
            product_data: { name: "Affisell CGV consent probe (delete)" },
          },
        },
      ],
      success_url: `${appOrigin()}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/`,
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        terms_of_service_acceptance: {
          message: `J'accepte les CGV Affisell (${tosUrl}).`,
        },
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })
    // Expire immediately so we don't leave junk sessions
    try {
      await stripe.checkout.sessions.expire(session.id)
    } catch {
      /* ignore */
    }
    pass(
      "Stripe CGV consent",
      `Session create OK — Dashboard ToS URL is configured (probe ${session.id.slice(0, 12)}… expired)`
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const needsTos =
      /terms of service|tos_url|business.?settings|public details/i.test(msg) ||
      (typeof e === "object" &&
        e !== null &&
        "code" in e &&
        String(e.code).includes("parameter"))
    fail(
      "Stripe CGV consent",
      needsTos
        ? `Configure Terms of service URL in Stripe Dashboard → Settings → Public details → ${tosUrl}\n     Stripe said: ${msg}`
        : `Checkout create failed: ${msg}`
    )
  }
}

await probeStripeCgvConsent()

console.log("\n[verify-launch] Affisell launch ops\n")
let hardFails = 0
for (const c of checks) {
  const mark = c.ok === true ? "✓" : c.ok === false ? "✗" : "!"
  if (c.ok === false) hardFails += 1
  console.log(`${mark} ${c.label}`)
  if (c.detail) console.log(`  ${c.detail}`)
}

console.log(`\nCGV URL to paste in Stripe: ${tosUrl}`)
console.log("Stripe Dashboard: https://dashboard.stripe.com/settings/public")
console.log("Vercel tokens:    https://vercel.com/account/tokens")
console.log("CM2C:             https://www.cm2c.net\n")

if (hardFails > 0) {
  console.error(`[verify-launch] ${hardFails} blocker(s) — fix before B2C launch.`)
  process.exit(1)
}

const soft = checks.filter((c) => c.ok === null).length
if (soft > 0) {
  console.log(`[verify-launch] OK with ${soft} warning(s) (médiateur membership).`)
} else {
  console.log("[verify-launch] OK — launch ops ready.")
}
