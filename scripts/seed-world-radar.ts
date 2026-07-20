#!/usr/bin/env tsx
/**
 * Seed World Radar countries + initial winners for FR, DE, US, UK, JP, BR, MA.
 * Idempotent — safe to run on every deploy when tables are empty.
 *
 * Usage: npm run radar:seed:world
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const PRIORITY = ["FR", "DE", "US", "UK", "JP", "BR", "MA"] as const

async function main() {
  const { seedWorldRadarCountries, scanAndPersistCountries, probeWorldRadarDb } =
    await import("../lib/radar/world-radar-store.server")

  const ready = await probeWorldRadarDb()
  if (!ready) {
    console.log("[seed-world-radar] World Radar tables not ready — skip (mock fallback active)")
    process.exit(0)
  }

  const seeded = await seedWorldRadarCountries()
  console.log("[seed-world-radar]", { result: "countries_seeded", count: seeded })

  const results = await scanAndPersistCountries([...PRIORITY])
  console.log("[seed-world-radar]", { result: "winners_seeded", results })
  process.exit(0)
}

main().catch((err) => {
  console.error("[seed-world-radar]", {
    result: "error",
    message: err instanceof Error ? err.message : "unknown",
  })
  process.exit(1)
})
