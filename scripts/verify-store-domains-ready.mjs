#!/usr/bin/env node
/**
 * Pre-flight before merchant custom domain auto-SSL in prod.
 * Run: npm run verify:store-domains
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
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

const token = process.env.VERCEL_API_TOKEN?.trim()
const projectId = process.env.VERCEL_PROJECT_ID?.trim()
const cname = process.env.STORE_CNAME_TARGET?.trim() || "cname.affisell.com"

ok(`STORE_CNAME_TARGET → ${cname}`)

if (token && projectId) {
  ok(`Vercel API configured (project ${projectId.slice(0, 8)}…)`)
} else {
  fail(
    "Vercel auto-SSL",
    "Set VERCEL_API_TOKEN + VERCEL_PROJECT_ID on Vercel for 1-click merchant HTTPS"
  )
}

for (const rel of [
  "lib/store-custom-domain-activation.ts",
  "app/api/cron/sync-store-vercel-domains/route.ts",
  "app/api/store/verify-domain/route.ts",
]) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing")
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed — merchants will need manual Vercel Domains.`)
  process.exit(1)
}

console.log("\nOK — Custom domain auto-SSL ready (cron sync-store-vercel-domains every 30 min).")
