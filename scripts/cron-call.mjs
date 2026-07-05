#!/usr/bin/env node
/**
 * Call a cron route with Bearer CRON_SECRET from .env (single value, no duplicate lines).
 * Usage:
 *   npm run cron:retry-pending-clawback
 *   npm run cron:call -- /api/cron/reconcile https://affisell.com
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function parseCronSecretLine(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith("CRON_SECRET=")) return null
  let val = trimmed.slice("CRON_SECRET=".length).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  val = val.trim()
  return val || null
}

/** First CRON_SECRET= per file; .env.local overrides .env. Warns on duplicates. */
function resolveCronSecret() {
  const root = process.cwd()
  let secret = null

  for (const name of [".env", ".env.local"]) {
    const path = resolve(root, name)
    if (!existsSync(path)) continue

    let seenInFile = 0
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const parsed = parseCronSecretLine(line)
      if (!parsed) continue
      seenInFile += 1
      if (seenInFile === 1) {
        secret = parsed
      } else {
        console.warn(
          `[cron-call] Ignoring duplicate CRON_SECRET in ${name} — remove extra lines to avoid curl 400`
        )
      }
    }
  }

  return secret
}

const cronPath = process.argv[2] ?? "/api/cron/retry-pending-clawback"
const baseArg = process.argv[3]
const base = (
  baseArg ??
  process.env.VERCEL_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3001"
)
  .trim()
  .replace(/\/$/, "")

const secret = resolveCronSecret()
if (!secret) {
  console.error("[cron-call] CRON_SECRET missing in .env")
  process.exit(1)
}

const url = `${base}${cronPath.startsWith("/") ? cronPath : `/${cronPath}`}`
console.log(`[cron-call] GET ${url}`)

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})

const body = await res.text()
console.log(body)

if (!res.ok) {
  console.error(`[cron-call] HTTP ${res.status}`)
  process.exit(1)
}
