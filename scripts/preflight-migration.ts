/**
 * READ-ONLY preflight before applying ONE migration (staging first). PASS / BLOCKED with evidence, exit 0 / 2.
 *
 *   DATABASE_URL='<url>' npm run preflight:migration -- --migration 20261127120000_supplier_purchase_claim \
 *     --expect-endpoint ep-shy-wind-<rest> --creates SupplierPurchaseClaim [--backup-branch staging-before-20261127]
 *
 * Explicit URL only (`.env*` is never read). The session is opened read-only BY THE SERVER
 * (default_transaction_read_only=on): any write would be refused by PostgreSQL itself. Never migrates — that is
 * `npm run schema:migrate`, after the owner's approval.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { formatPreflight, migrationChecksum, runMigrationPreflight } from "../lib/migrations/preflight"
import { classifyDatabaseUrl } from "./schema-deploy.mjs"
import { withReadOnlySession } from "./prisma-explicit-db.mjs"

const URLS = ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED"]

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(2)
}
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? "") : null
}

async function main() {
  const migration = arg("--migration") ?? fail("--migration <name> is required")
  const expectEndpoint = arg("--expect-endpoint") ?? fail("--expect-endpoint <ep-…> is required")
  const creates = (arg("--creates") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const backup = arg("--backup-branch")
  const url =
    process.env.DATABASE_URL?.trim() || fail("DATABASE_URL is not set (pass it explicitly; .env files are never read)")

  const endpoints = new Set(
    URLS.map((n) => process.env[n]?.trim())
      .filter((v): v is string => Boolean(v))
      .map((v) => classifyDatabaseUrl(v).endpoint),
  )
  if (endpoints.size !== 1) fail(`${URLS.join(" / ")} name different endpoints: ${[...endpoints].join(", ")}`)
  const target = classifyDatabaseUrl(url)
  console.log(
    `Target: ${target.maskedHost} (endpoint ${target.endpoint}, branch ${target.branch}) — READ-ONLY preflight`,
  )

  const dir = join(process.cwd(), "prisma/migrations")
  const localMigrations = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  if (!localMigrations.includes(migration)) fail(`prisma/migrations/${migration} does not exist`)
  const localChecksum = migrationChecksum(readFileSync(join(dir, migration, "migration.sql")))

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
  try {
    const result = await runMigrationPreflight(prisma, {
      migration,
      localChecksum,
      localMigrations,
      urlEndpoint: target.endpoint,
      expectEndpoint,
      createsTables: creates,
      backupConfirmed: backup,
    })
    console.log(formatPreflight(result))
    process.exit(result.verdict === "PASS" ? 0 : 2)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
