#!/usr/bin/env node
/**
 * DropForge import preflight — AliExpress API + ScrapingBee fallback.
 * Usage: npm run verify:dropforge
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

for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  loadDotEnv(resolve(process.cwd(), name))
}

function readFirst(keys) {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return ""
}

const appKey = readFirst(["ALIEXPRESS_APP_KEY", "ALIEXPRESS_KEY"])
const appSecret = readFirst(["ALIEXPRESS_APP_SECRET", "ALIEXPRESS_SECRET", "ALIEXPRESS_APPSECRET"])
const accessToken = readFirst([
  "ALIEXPRESS_ACCESS_TOKEN",
  "ALIEXPRESS_TOKEN",
  "ALIEXPRESS_SESSION",
  "ALIEXPRESS_SESSION_KEY",
])
const refreshToken = readFirst(["ALIEXPRESS_REFRESH_TOKEN"])
const scrapingBee = readFirst(["SCRAPINGBEE_API_KEY"])
const scrapingBeeOk =
  Boolean(scrapingBee) &&
  !["free_key_here", "your_api_key", "changeme"].includes(scrapingBee.toLowerCase())

const aeConfigured =
  Boolean(appKey && appSecret) && Boolean(accessToken || refreshToken)

const missing = []
if (!appKey) missing.push("ALIEXPRESS_APP_KEY")
if (!appSecret) missing.push("ALIEXPRESS_APP_SECRET")
if (!accessToken && !refreshToken) {
  missing.push("ALIEXPRESS_ACCESS_TOKEN (ou ALIEXPRESS_REFRESH_TOKEN)")
}

console.log("\n[verify:dropforge] DropForge import readiness\n")
console.log(`  AliExpress API : ${aeConfigured ? "✓ configured (env tokens)" : "○ env tokens absent"}`)
if (!aeConfigured && missing.length > 0) {
  console.log(`    → ${missing.join(", ")}`)
}
console.log(
  "  OAuth DB       : (prod) tokens chiffrés via callback — pas vérifiable hors serveur"
)
console.log(
  "    → après OAuth OK, tester GET /api/supplier/aliexpress/health (session fournisseur)"
)
console.log(`  ScrapingBee    : ${scrapingBeeOk ? "✓ key present" : "✗ SCRAPINGBEE_API_KEY missing"}`)

const trackingSample =
  "https://s.click.aliexpress.com/e/_pTest?_p_origin_prod:1005012670002032"
const idMatch =
  trackingSample.match(/_p_origin_prod[=:%3A]+(\d{13,})/i)?.[1] ??
  trackingSample.match(/(\d{13,})/)?.[1]
console.log(
  `  URL normalize  : ${idMatch ? "✓ tracking embeds product id" : "✗ parse regression"}`
)
if (idMatch) {
  console.log(`    → canonical https://www.aliexpress.com/item/${idMatch}.html`)
}

if (!aeConfigured && !scrapingBeeOk) {
  console.error(
    "\n✗ DropForge AliExpress imports need env tokens OR OAuth DB session + app creds, or SCRAPINGBEE_API_KEY.\n"
  )
  process.exit(1)
}

if (!aeConfigured && scrapingBeeOk) {
  console.log(
    "\n⚠ Env tokens absents — OK si OAuth prod déjà enregistré (persisted: true). Vérifiez /api/supplier/aliexpress/health.\n"
  )
  process.exit(0)
}

console.log("\n✓ DropForge import path ready (API and/or scrape fallback).\n")
