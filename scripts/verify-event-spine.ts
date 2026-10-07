/**
 * READ-ONLY check that the event-spine schema is really in a database (see lib/events/schema-check.ts for why
 * `prisma migrate status` is not enough).
 *
 *   DATABASE_URL='<url>' npm run verify:event-spine                    → prints the state, exit 0 only if "present"
 *   DATABASE_URL='<url>' npm run verify:event-spine -- --expect absent → exit 0 only if "absent" (sanity check BEFORE migrating)
 *
 * The database it talks to is the one YOU pass on the command line — nothing else, ever. IMPORTANT: importing
 * `@prisma/client` loads the repository's `.env` into process.env (which holds the PRODUCTION url) when the variable is
 * unset. So the URL is captured FIRST, and `@prisma/client` is imported only afterwards (dynamically), once we know an
 * explicit URL exists; with none, the script exits before Prisma is ever loaded. It runs three constant SELECTs on the
 * catalog and nothing else — in a session the database server keeps read-only.
 */
import { extractHostFromDatabaseUrl, maskDbHost, resolveNeonBranchFromHost } from "../lib/db-env"
import { withReadOnlySession } from "./prisma-explicit-db.mjs"
import { EVENT_SPINE_CATALOG_SQL, evaluateEventSpineSchema, type EventSpineCatalog } from "../lib/events/schema-check"

/** Captured before anything that could load a .env file (see the note above). */
const EXPLICIT_DATABASE_URL = process.env.DATABASE_URL?.trim()

function fail(message: string, code = 2): never {
  console.error(`✗ ${message}`)
  process.exit(code)
}

async function main() {
  const args = process.argv.slice(2)
  const expectIndex = args.indexOf("--expect")
  const expected = expectIndex >= 0 ? args[expectIndex + 1] : "present"
  if (expected !== "present" && expected !== "absent") fail('--expect must be "present" or "absent"')

  const url = EXPLICIT_DATABASE_URL
  if (!url) {
    fail("DATABASE_URL is not set. Pass it explicitly (this script never uses .env files):  DATABASE_URL='…' npm run verify:event-spine")
  }
  const host = extractHostFromDatabaseUrl(url)
  console.log(`Target database: ${maskDbHost(host)} (branch: ${resolveNeonBranchFromHost(host)}) — read-only catalog check`)

  const { PrismaClient } = await import("@prisma/client")
  // The three catalog SELECTs run in a session the DATABASE SERVER keeps read-only: a write would be refused by PostgreSQL itself.
  const prisma = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
  try {
    const [columns, indexes, constraints] = (await Promise.all([
      prisma.$queryRawUnsafe(EVENT_SPINE_CATALOG_SQL.columns),
      prisma.$queryRawUnsafe(EVENT_SPINE_CATALOG_SQL.indexes),
      prisma.$queryRawUnsafe(EVENT_SPINE_CATALOG_SQL.constraints),
    ])) as [EventSpineCatalog["columns"], EventSpineCatalog["indexes"], EventSpineCatalog["constraints"]]

    const report = evaluateEventSpineSchema({ columns, indexes, constraints })
    console.log(`Event-spine schema: ${report.state.toUpperCase()} (${report.found.length} found, ${report.missing.length} missing)`)
    if (report.state !== "present" && report.missing.length > 0) {
      for (const m of report.missing) console.log(`  missing: ${m}`)
    }
    if (report.state === "partial") {
      console.error("✗ PARTIAL schema: a migration probably failed half-way. Do NOT deploy the new code. Fix the database first.")
    }
    const ok = report.state === expected
    console.log(ok ? `✓ matches the expectation (${expected})` : `✗ expected "${expected}" but found "${report.state}"`)
    process.exit(ok ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => fail(`verification failed: ${error instanceof Error ? error.message : String(error)}`, 3))
