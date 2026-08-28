#!/usr/bin/env node
/**
 * Affisell environment preflight — LOCAL / PREVIEW / PRODUCTION + DB safety checks.
 * Used by: npm run env:check, scripts/dev-preflight.mjs
 */
import {
  formatEnvCheckLine,
  getDbEnvSnapshot,
  runEnvSecurityChecks,
} from "./env-shared.mjs"

const { ok, snapshot } = runEnvSecurityChecks({
  exitOnFail: process.env.NODE_ENV === "production",
})

console.log(formatEnvCheckLine(snapshot))

if (snapshot.endpointId) {
  console.log(`[affisell env] endpoint=${snapshot.endpointId}`)
}

if (!ok) {
  process.exitCode = 1
}
