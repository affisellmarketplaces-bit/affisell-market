/**
 * Capture Sentinel — runs the synthetic probe of the presence-history capture (lib/listing-presence/capture-sentinel*.ts).
 *
 *   npm run probe:capture-sentinel            → probe, text summary
 *   npm run probe:capture-sentinel -- --json  → probe, JSON result (input of report:collection-snapshot --sentinel)
 *   npm run probe:capture-sentinel -- --cleanup → removes COMMITTED sentinel residue only (rows carrying both markers)
 *
 * Destination: ONLY the disposable test database named by DATABASE_URL_TEST in .env.test.local. The rules: a loopback
 * host, a database name that says « test », and nothing that matches DATABASE_URL / DIRECT_URL / DATABASE_URL_STAGING.
 * Production, staging (prepared, not enabled) and any database that can not be classified are refused BEFORE any
 * connection. The probe writes inside ONE transaction that it always rolls back.
 *
 * Exit codes: 0 PASS · 1 FAIL · 2 not run (refused) · 3 UNKNOWN.
 */
import path from "node:path"

import { cleanupSentinelResidue, runCaptureSentinel } from "../lib/listing-presence/capture-sentinel-run"
import { decideSentinelDestination, type SentinelResult } from "../lib/listing-presence/capture-sentinel"
import { readEnvFile } from "../lib/testing/db-test-guard"
import { assertNotProductionByAccident } from "./lib/production-guard.mjs"

const PROTECTED_KEYS = ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "DATABASE_URL_STAGING"]

function summary(r: SentinelResult): string {
  const out = [`Capture Sentinel — ${r.overall}${r.environment ? ` (${r.environment.kind}, mode ${r.mode}, fuseau ${r.timeZone})` : ""}`]
  if (r.refusal) out.push(`  non exécutée : ${r.refusal}`)
  for (const c of r.checks) out.push(`  [${c.status}] ${c.id} — ${c.detail}`)
  if (r.captureDelayMsMax != null) out.push(`  délai de capture max : ${r.captureDelayMsMax} ms (dans la transaction)`)
  out.push("", "Ce que la sonde NE prouve PAS :", ...r.limits.map((l) => `  - ${l}`))
  return out.join("\n")
}

async function main() {
  const root = process.cwd()
  const testEnv = readEnvFile(path.join(root, ".env.test.local"))
  const url = testEnv.DATABASE_URL_TEST
  const protectedUrls: Array<string | undefined> = []
  for (const f of [".env", ".env.local", ".env.production.local", ".env.development.local"]) {
    const env = readEnvFile(path.join(root, f))
    for (const k of PROTECTED_KEYS) protectedUrls.push(env[k])
  }
  for (const k of PROTECTED_KEYS) protectedUrls.push(process.env[k])
  const destination = decideSentinelDestination({ url, protectedUrls, env: process.env })
  const connect = async () => {
    // Second, independent guard on the very URL the client will use.
    assertNotProductionByAccident("probe:capture-sentinel", { env: { DATABASE_URL: url }, urlVariables: ["DATABASE_URL"] })
    const { PrismaClient } = await import("@prisma/client")
    return new PrismaClient({ datasources: { db: { url: url! } }, log: [] })
  }

  if (process.argv.includes("--cleanup")) {
    const r = await cleanupSentinelResidue({ destination, connect })
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.done ? 0 : 2
    return
  }
  const result = await runCaptureSentinel({ destination, connect })
  console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : summary(result))
  process.exitCode = result.overall === "PASS" ? 0 : result.overall === "FAIL" ? 1 : result.overall === "NOT_RUN" ? 2 : 3
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  () => {
    console.error("Capture Sentinel : erreur inattendue (détail non affiché)")
    process.exit(3)
  },
)
