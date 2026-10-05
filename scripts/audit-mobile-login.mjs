#!/usr/bin/env node
/**
 * One-time sign-in for the signed-in mobile audit — you log in, the script only keeps the resulting session.
 *
 *   npm run audit:mobile-login -- buyer|affiliate|supplier
 *
 * Opens a real Chromium window on the role's login page. YOU type the credentials (or use the usual social login) in
 * that window; nothing is typed, read or stored by this script except the cookies the app itself sets afterwards.
 * Once the app leaves the login/signup pages the session is written to `.audit-sessions/<role>.json` (git-ignored,
 * file mode 600 — it is equivalent to a logged-in browser, treat it like a password) and the window closes.
 *
 * Then: `npm run audit:mobile-overflow -- --preset=<role>`. Use a throw-away or test account of that role, and re-run
 * this when the audit reports "session expired". Needs the dev server running (BASE_URL, default http://localhost:3001).
 */
import { chmodSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "")
const LOGIN_PATH = { buyer: "/login/customer", affiliate: "/login/affiliate", supplier: "/login/supplier" }

const role = process.argv[2]
if (!role || !(role in LOGIN_PATH)) {
  console.error("usage: npm run audit:mobile-login -- buyer|affiliate|supplier")
  process.exit(1)
}

const origin = new URL(BASE).origin
const authPages = /^\/(login|signup|auth)(\/|$)/
const out = join(ROOT, ".audit-sessions", `${role}.json`)

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 430, height: 880 } })
const page = await context.newPage()
await page.goto(`${BASE}${LOGIN_PATH[role]}`)
console.log(`Log in as a ${role} in the window that just opened (waiting up to 10 minutes)…`)

try {
  // Same origin AND off the auth pages: a social-login detour through another host must not count as "done".
  await page.waitForURL((url) => url.origin === origin && !authPages.test(url.pathname), { timeout: 600_000 })
  await page.waitForTimeout(1_500)
  mkdirSync(dirname(out), { recursive: true })
  await context.storageState({ path: out })
  chmodSync(out, 0o600)
  console.log(`Saved ${out}\nNow run: npm run audit:mobile-overflow -- --preset=${role}`)
} catch {
  console.error("No sign-in detected — nothing saved.")
  process.exitCode = 1
} finally {
  await browser.close()
}
