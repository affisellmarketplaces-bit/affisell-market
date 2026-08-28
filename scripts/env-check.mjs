#!/usr/bin/env node
/**
 * Affisell environment preflight — LOCAL / PREVIEW / PRODUCTION + DB safety checks.
 * Used by: npm run env:check, scripts/dev-preflight.mjs
 */
import { config } from "dotenv"

import {
  formatEnvCheckLine,
  formatFeatureFlagsLine,
  getDbEnvSnapshot,
  resolveDatabaseUrl,
  runEnvSecurityChecks,
} from "./env-shared.mjs"

let dotenvLoaded = false

export function loadAffisellEnvFiles() {
  if (dotenvLoaded) return
  config({ path: ".env.local" })
  config({ path: ".env" })
  dotenvLoaded = true
}

/**
 * @param {{ exitOnFail?: boolean }} [options]
 */
export function runEnvCheck(options = {}) {
  loadAffisellEnvFiles()

  const exitOnFail =
    options.exitOnFail ??
    (process.env.NODE_ENV === "production" && !process.argv.includes("--soft"))

  const databaseUrl = process.env.DATABASE_URL?.trim() || resolveDatabaseUrl()
  const { ok, snapshot } = runEnvSecurityChecks({ exitOnFail })

  console.log(formatEnvCheckLine(snapshot))
  console.log(formatFeatureFlagsLine(snapshot))

  if (snapshot.endpointId) {
    console.log(`[affisell env] endpoint=${snapshot.endpointId}`)
  }

  if (!databaseUrl) {
    console.warn(
      "[affisell env] DATABASE_URL unset — copy .env.local.example → .env.local and set DATABASE_URL or DATABASE_URL_STAGING"
    )
  }

  if (!ok) {
    process.exitCode = 1
    if (exitOnFail) process.exit(1)
  }

  return { ok, snapshot }
}

const isMain =
  process.argv[1]?.endsWith("env-check.mjs") &&
  !process.argv[1]?.includes("node_modules")

if (isMain) {
  runEnvCheck()
}
