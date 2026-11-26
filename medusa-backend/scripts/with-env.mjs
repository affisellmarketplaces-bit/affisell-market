#!/usr/bin/env node
/**
 * Run Medusa CLI with medusa-backend/.env (override shell — avoids stale DATABASE_URL).
 * DATABASE_URL must come from medusa-backend/.env or the shell, never from ../.env.local, and never names production
 * without AFFISELL_ALLOW_PRODUCTION_WRITES (lib/database-target-guard.mjs).
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { config as loadEnv, parse as parseEnv } from "dotenv"

import { assessMedusaDatabaseTarget } from "./lib/database-target-guard.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(root, ".env")

if (!existsSync(envPath)) {
  console.error("❌ medusa-backend/.env missing. Copy medusa-backend/.env.template and fill it.")
  process.exit(1)
}

const readEnvFile = (path) => (existsSync(path) ? parseEnv(readFileSync(path)) : {})
const shellEnv = { ...process.env }
const medusaEnvFile = readEnvFile(envPath)
loadEnv({ path: envPath, override: true, quiet: true })

const parentLocal = resolve(root, "..", ".env.local")
const parentEnvFile = readEnvFile(parentLocal)
if (existsSync(parentLocal)) {
  loadEnv({ path: parentLocal, override: false, quiet: true })
}
const envGenerated = resolve(root, ".env.generated")
if (existsSync(envGenerated)) {
  loadEnv({ path: envGenerated, override: false, quiet: true })
}

// Never let a Medusa command inherit the main app's (production) database, nor reach production unconfirmed.
const target = assessMedusaDatabaseTarget({
  env: process.env,
  medusaEnvFile,
  parentEnvFile,
  shellEnv,
  tool: "medusa-backend/with-env",
})
if (!target.ok) {
  console.error(`\n✗ REFUSED (${target.code}): ${target.reason}\n`)
  process.exit(2)
}

const required = ["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET", "STORE_CORS", "ADMIN_CORS"]
const missing = required.filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error("❌ Missing in medusa-backend/.env:", missing.join(", "))
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <medusa args...>")
  process.exit(1)
}

const result = spawnSync("npx", ["medusa", ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)
