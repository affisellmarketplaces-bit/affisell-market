#!/usr/bin/env node
/**
 * Pre-flight for buyer PWA offline shell + Web Push service worker.
 * Run: npm run verify:pwa-shell
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const CATALOG_API_PATH = "/api/marketplace/products"

const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

const requiredFiles = [
  "public/sw.js",
  "lib/pwa-shell-shared.ts",
  "components/pwa/pwa-shell-register.tsx",
  "app/offline/page.tsx",
]

for (const rel of requiredFiles) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing — PWA shell wiring incomplete")
}

const swPath = resolve(process.cwd(), "public/sw.js")
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf8")
  if (sw.includes('addEventListener("install"')) ok("service worker install precache")
  else fail("public/sw.js install", "Missing install handler for offline shell")
  if (sw.includes('addEventListener("fetch"')) ok("service worker fetch routing")
  else fail("public/sw.js fetch", "Missing fetch handler for catalog shell")
  if (sw.includes(CATALOG_API_PATH)) ok("service worker caches marketplace products API")
  else fail("public/sw.js catalog", "Must cache /api/marketplace/products")
  if (sw.includes("payload.tag")) ok("service worker uses dynamic notification tag")
  else fail("public/sw.js tag", "Push payload must pass tag for order vs price alerts")
  if (sw.includes("self.location.origin")) ok("service worker resolves relative click URLs")
  else fail("public/sw.js click URL", "notificationclick must resolve relative paths")
}

const rootShell = resolve(process.cwd(), "app/root-intl-session.tsx")
if (existsSync(rootShell)) {
  const src = readFileSync(rootShell, "utf8")
  if (src.includes("PwaShellRegister")) ok("PwaShellRegister mounted in root shell")
  else fail("PwaShellRegister", "Register SW from RootSessionShell for buyer shell")
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log("\nOK — PWA buyer shell ready (offline page + catalog cache).")
