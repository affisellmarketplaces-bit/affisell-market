#!/usr/bin/env node
/**
 * Dev preflight — generate Prisma clients quietly, then hand off to next-dev-port.
 * Keeps Cursor terminal readable: one Affisell banner instead of Prisma tip spam.
 */
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

import { formatEnvCheckLine, getDbEnvSnapshot, runEnvSecurityChecks } from "./env-shared.mjs"

const require = createRequire(import.meta.url)
const prismaBin = require.resolve("prisma/build/index.js")

function runPrismaGenerate(schemaPath) {
  const args = ["generate"]
  if (schemaPath) args.push("--schema", schemaPath)

  const result = spawnSync(process.execPath, [prismaBin, ...args], {
    env: {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    encoding: "utf8",
  })

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
}

console.log("\n[affisell dev] Affisell — preparing local dev…")

const { ok, snapshot } = runEnvSecurityChecks({ exitOnFail: false })
console.log(formatEnvCheckLine(snapshot))
if (!ok) {
  console.warn("[affisell dev] Environment warnings above — fix before shipping to Preview.\n")
}

runPrismaGenerate()
runPrismaGenerate("prisma/radar.schema.prisma")

console.log("[affisell dev] Prisma clients ready\n")
