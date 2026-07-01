#!/usr/bin/env node
/**
 * Pre-flight before enabling Web Push price alerts in prod.
 * Run: npm run verify:web-push
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

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()

if (publicKey && privateKey) {
  ok(`VAPID keys configured (${publicKey.slice(0, 12)}…)`)
} else {
  fail("VAPID keys", "Run: npx web-push generate-vapid-keys → set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY")
}

for (const rel of ["public/sw.js", "app/api/push/subscribe/route.ts", "lib/web-push-send.ts"]) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing")
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log("\nOK — Web Push ready. Run: npx prisma migrate deploy (PushSubscription table).")
