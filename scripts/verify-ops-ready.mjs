#!/usr/bin/env node
/**
 * Production ops pre-flight — Web Push + custom domains + expansion cron wiring.
 * Run: npm run verify:ops
 */
import { spawnSync } from "node:child_process"
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

loadDotEnv(resolve(process.cwd(), ".env.local"))
loadDotEnv(resolve(process.cwd(), ".env"))

const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })
const warn = (label, hint) => checks.push({ label, pass: true, warn: hint })

function runScript(label, scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  })
  if (result.status === 0) {
    ok(label)
    return true
  }
  fail(label, `Exit ${result.status ?? "?"} — run node ${scriptPath}`)
  if (result.stdout?.trim()) console.log(result.stdout.trim())
  if (result.stderr?.trim()) console.error(result.stderr.trim())
  return false
}

if (process.env.CRON_SECRET?.trim()) {
  ok("CRON_SECRET configured (GitHub Actions → /api/cron/*)")
} else {
  warn("CRON_SECRET", "Set on Vercel Production + GitHub repo secrets for scheduled crons")
}

const ghWorkflow = resolve(process.cwd(), ".github/workflows/scheduled-crons.yml")
if (existsSync(ghWorkflow)) {
  ok("GitHub scheduled-crons workflow present")
} else {
  fail("scheduled-crons.yml", "Missing — expansion-ops / push crons won't run")
}

console.log("\n[verify-ops] Tier 4 Ops — production activation\n")

const pricingOk = runScript("Pricing pipeline preflight", "scripts/verify-pricing-ops-ready.mjs")
const webPushOk = runScript("Web Push preflight", "scripts/verify-web-push-ready.mjs")
const domainsOk = runScript("Store domains preflight", "scripts/verify-store-domains-ready.mjs")
const ltvOpsOk = runScript("LTV ops preflight", "scripts/verify-ltv-ops-ready.mjs")
const expansionOk = runScript("ROW expansion preflight (optional)", "scripts/verify-expansion-ready.mjs")
if (!expansionOk) {
  warn("ROW expansion", "Optional for Ops — run npm run verify:expansion before country pilots")
}

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  ok("Web Push keys present in env")
} else {
  warn("Web Push", "Generate: npx web-push generate-vapid-keys → Vercel env")
}

if (process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim()) {
  ok("Vercel domain API ready for merchant auto-SSL")
} else {
  warn("Vercel domains", "VERCEL_API_TOKEN + VERCEL_PROJECT_ID on Vercel for 1-click HTTPS")
}

const failed = checks.filter((c) => !c.pass)
const warnings = checks.filter((c) => c.warn)

console.log("\nVercel Production checklist:")
console.log("  1. npm run verify:ops")
console.log("  2. npm run pricing:ops-playbook   # affiliate pricing smoke tests")
console.log("  3. npm run expansion:c-suite      # active pilots → graduation")
console.log("  4. Vercel → env: VAPID_*, VERCEL_API_TOKEN, VERCEL_PROJECT_ID, CRON_SECRET, RESEND_*")
console.log("  5. GitHub → Settings → Secrets → CRON_SECRET (same value)")
console.log("  6. Redeploy → curl /api/cron/migrate → test push + wholesale guard")

if (failed.length > 0 || !pricingOk || !webPushOk || !domainsOk || !ltvOpsOk) {
  console.log(`\n[verify-ops] Fix pricing pipeline, Web Push and/or store domains before prod activation.\n`)
  process.exit(1)
}

console.log(
  `\n[verify-ops] Ready${warnings.length ? ` (${warnings.length} env warning(s) on Vercel)` : ""}.\n`
)
