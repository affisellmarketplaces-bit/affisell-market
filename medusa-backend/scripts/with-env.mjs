#!/usr/bin/env node
/**
 * Run Medusa CLI with medusa-backend/.env only (override shell — avoids stale DATABASE_URL).
 */
import { existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(root, ".env")

if (!existsSync(envPath)) {
  console.error("❌ medusa-backend/.env missing. Copy 6 vars from ../.env.local")
  process.exit(1)
}

loadEnv({ path: envPath, override: true })

const parentLocal = resolve(root, "..", ".env.local")
if (existsSync(parentLocal)) {
  loadEnv({ path: parentLocal, override: false })
}
const envGenerated = resolve(root, ".env.generated")
if (existsSync(envGenerated)) {
  loadEnv({ path: envGenerated, override: false })
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
