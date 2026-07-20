#!/usr/bin/env node
/**
 * Safe PROD seed for World Radar (Neon market_intelli).
 * Interactive confirmation required — never runs unattended.
 *
 * Usage: npm run radar:seed:prod
 */
import { createInterface } from "node:readline"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const PRIORITY_COUNT = 31 // all WORLD_RADAR_COUNTRIES when seed:world runs without --countries

function maskUrl(url) {
  try {
    const u = new URL(url)
    if (u.password) u.password = "***"
    return u.toString()
  } catch {
    return url.replace(/:\/\/([^:/@]+):([^@]+)@/, "://$1:***@")
  }
}

function neonHostLabel(url) {
  try {
    const host = new URL(url).hostname
    const ep = host.match(/^(ep-[a-z0-9-]+)/i)
    return ep ? ep[1] : host
  } catch {
    return "unknown-host"
  }
}

function resolveProdUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.RADAR_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  )
}

function assertLooksLikeProdNeon(url) {
  const lower = url.toLowerCase()
  if (!lower.includes("neon.tech")) {
    throw new Error(
      "URL does not contain neon.tech — refusing to seed (set DATABASE_URL_UNPOOLED to Neon prod)."
    )
  }
  // Accept Neon hosts; market_intelli is schema-level (same DB as Affisell).
  if (/localhost|127\.0\.0\.1|:5433|:5434/.test(lower)) {
    throw new Error("Looks like a local Docker URL — refusing to seed as PROD.")
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolveAsk) => {
    rl.question(question, (answer) => {
      rl.close()
      resolveAsk(answer.trim())
    })
  })
}

async function main() {
  const url = resolveProdUrl()
  if (!url) {
    console.error(
      "[seed-prod-safe] Missing DATABASE_URL_UNPOOLED (or RADAR_DATABASE_URL / DATABASE_URL) in .env.local"
    )
    process.exit(1)
  }

  try {
    assertLooksLikeProdNeon(url)
  } catch (err) {
    console.error("[seed-prod-safe]", err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const host = neonHostLabel(url)
  console.log("")
  console.log("═══════════════════════════════════════════════════")
  console.log("  WORLD RADAR — PROD SEED (SAFE)")
  console.log("═══════════════════════════════════════════════════")
  console.log(`  Host:  ${host}`)
  console.log(`  URL:   ${maskUrl(url)}`)
  console.log(`  Pays:  all ${PRIORITY_COUNT} enabled markets (WORLD_RADAR_COUNTRIES)`)
  console.log("═══════════════════════════════════════════════════")
  console.log("")

  const answer = await ask(
    `Tu vas seed la PROD Neon (${host}...), pas la dev. Tape PROD pour continuer: `
  )
  if (answer !== "PROD") {
    console.log("[seed-prod-safe] Aborted — confirmation PROD required.")
    process.exit(0)
  }

  console.log("[seed-prod-safe] Running npm run radar:seed:world …")
  const env = {
    ...process.env,
    DATABASE_URL_UNPOOLED: url,
    DATABASE_URL: process.env.DATABASE_URL?.trim() || url,
    RADAR_DATABASE_URL: process.env.RADAR_DATABASE_URL?.trim() || url,
  }

  const result = spawnSync("npm", ["run", "radar:seed:world"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  })

  if ((result.status ?? 1) !== 0) {
    console.error("[seed-prod-safe] Seed failed. If schema missing: npm run radar:db:push")
    process.exit(result.status ?? 1)
  }

  console.log("")
  console.log(`[PROD] ✅ Seeded ${PRIORITY_COUNT} countries × ~20 winners`)
  console.log("")
  console.log("Va vérifier (session Pro requise):")
  console.log("  https://affisell.com/api/radar?country=FR  → doit retourner 20 winners")
  console.log("  https://affisell.com/radar?country=FR")
  console.log("")
}

main().catch((err) => {
  console.error("[seed-prod-safe]", err instanceof Error ? err.message : err)
  process.exit(1)
})
