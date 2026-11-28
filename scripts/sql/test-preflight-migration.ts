/**
 * The migration preflight (lib/migrations/preflight.ts) against a REAL local PostgreSQL: one throwaway database per
 * scenario with a real `_prisma_migrations` table, the checks run in a session the server keeps READ-ONLY
 * (PGOPTIONS default_transaction_read_only=on), and a write in that session is proven refused.
 *
 *   PGHOST=/tmp PGPORT=55432 PGUSER=postgres npx tsx scripts/sql/test-preflight-migration.ts
 *
 * Local only (refuses any other host). Drops its databases.
 */
import { execFileSync } from "node:child_process"

import { migrationChecksum, runMigrationPreflight, type PreflightInput } from "../../lib/migrations/preflight"
import { PsqlSession } from "./lib/psql-session"

const host = process.env.PGHOST ?? ""
if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) {
  console.error("refused: PGHOST must be a local socket dir or localhost")
  process.exit(2)
}
const admin = (sql: string, db = "postgres") =>
  execFileSync("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGOPTIONS: "" },
  }).trim()

let failures = 0
// A psql session that dies leaves a promise pending forever: Node then exits 0 by itself. Never let that pass as success.
let finished = false
process.on("beforeExit", () => {
  if (!finished) {
    console.error("FAIL: the test stopped before its end (a session died or a promise never settled)")
    process.exit(1)
  }
})
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}`}`)
  if (!ok) failures++
}

const TARGET = "20261127120000_supplier_purchase_claim"
const PREVIOUS = [
  "20261007100000_supplier_compliance_profile",
  "20261007120000_order_return_terms",
  "20261007140000_event_spine",
]
const SQL_TEXT = 'CREATE TABLE "SupplierPurchaseClaim" ("id" TEXT PRIMARY KEY);'
const SUM = migrationChecksum(SQL_TEXT)
const base: PreflightInput = {
  migration: TARGET,
  localChecksum: SUM,
  localMigrations: [...PREVIOUS, TARGET],
  urlEndpoint: "ep-shy-wind-test",
  expectEndpoint: "ep-shy-wind-test",
  createsTables: ["SupplierPurchaseClaim"],
  backupConfirmed: "staging-before-20261127",
}
const MIGRATIONS_DDL = `CREATE TABLE "_prisma_migrations" ("id" VARCHAR(36) PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`
const row = (name: string, sum = "x".repeat(64), finished = true, rolledBack = false) =>
  `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","rolled_back_at")
   VALUES (gen_random_uuid()::text, '${sum}', ${finished ? "now()" : "NULL"}, '${name}', ${rolledBack ? "now()" : "NULL"})`

let n = 0
async function scenario(
  name: string,
  setup: string[],
  input: Partial<PreflightInput>,
  expect: (r: Awaited<ReturnType<typeof runMigrationPreflight>>) => boolean,
  during?: (db: string) => Promise<() => void>,
  readOnly = true,
) {
  const db = `preflight_t${process.pid}_${++n}`
  admin(`CREATE DATABASE ${db}`)
  try {
    for (const s of setup) admin(s, db)
    process.env.PGDATABASE = db
    process.env.PGOPTIONS = ""
    const release = during ? await during(db) : () => {}
    process.env.PGOPTIONS = readOnly ? "-c default_transaction_read_only=on" : ""
    const s = new PsqlSession()
    try {
      const r = await runMigrationPreflight(s, { ...base, ...input })
      check(
        name,
        expect(r),
        r.checks.filter((c) => c.status === "BLOCKED"),
      )
    } finally {
      await s.close()
      release()
    }
  } finally {
    admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  }
}
const blocked = (id: string) => (r: Awaited<ReturnType<typeof runMigrationPreflight>>) =>
  r.verdict === "BLOCKED" && r.checks.some((c) => c.id === id && c.status === "BLOCKED")
const clean = [MIGRATIONS_DDL, ...PREVIOUS.map((p) => row(p))]

async function main() {
  await scenario(
    "clean staging: only the target pending, table absent, backup stated → PASS",
    clean,
    {},
    (r) => r.verdict === "PASS" && r.checks.find((c) => c.id === "session.read_only")?.status === "PASS",
  )
  await scenario("no backup stated → BLOCKED", clean, { backupConfirmed: null }, blocked("backup"))
  await scenario("wrong endpoint → BLOCKED", clean, { expectEndpoint: "ep-misty-sea-prod" }, blocked("target.endpoint"))
  await scenario(
    "an OLDER migration is also pending (deploy would apply it too) → BLOCKED",
    [MIGRATIONS_DDL, row(PREVIOUS[0]), row(PREVIOUS[1])],
    {},
    blocked("history.pending_exactly_one"),
  )
  await scenario(
    "a different version of the target was recorded (rolled back) → BLOCKED",
    [...clean, row(TARGET, "a".repeat(64), false, true)],
    {},
    blocked("checksum"),
  )
  await scenario(
    "a failed migration in the history → BLOCKED",
    [...clean, row(TARGET, SUM, false, false)],
    {},
    blocked("history.failed"),
  )
  await scenario(
    "applied migration unknown to the repository → BLOCKED",
    [...clean, row("20991231000000_from_elsewhere")],
    {},
    blocked("history.diverged"),
  )
  await scenario(
    "table created by hand while not recorded → BLOCKED",
    [...clean, SQL_TEXT],
    {},
    blocked("object.SupplierPurchaseClaim"),
  )
  await scenario("no _prisma_migrations at all → BLOCKED", [], {}, blocked("history.table"))
  await scenario(
    "already applied (same checksum) → BLOCKED: nothing pending to apply",
    [...clean, row(TARGET, SUM)],
    {},
    blocked("history.pending_exactly_one"),
  )
  // Prisma's migration lock held by another session
  await scenario(
    "Prisma's migration lock held elsewhere → BLOCKED",
    clean,
    {},
    blocked("locks.prisma_migration"),
    async () => {
      const holder = new PsqlSession()
      await holder.$queryRawUnsafe(`SELECT pg_advisory_lock(72707369)`)
      return () => void holder.close().catch(() => {})
    },
  )

  await scenario(
    "a session that is NOT read-only → BLOCKED (the preflight refuses to vouch for itself)",
    clean,
    {},
    blocked("session.read_only"),
    undefined,
    false,
  )

  // The session really is read-only: a write is refused by the server.
  {
    const db = `preflight_t${process.pid}_ro`
    admin(`CREATE DATABASE ${db}`)
    try {
      admin(MIGRATIONS_DDL, db)
      process.env.PGDATABASE = db
      process.env.PGOPTIONS = "-c default_transaction_read_only=on"
      const s = new PsqlSession()
      let refused = false
      try {
        await s.$executeRawUnsafe(`DELETE FROM "_prisma_migrations"`)
      } catch (e) {
        refused = /read-only transaction/.test(String(e))
      }
      await s.close()
      check("the preflight session refuses writes (server-enforced read-only)", refused)
    } finally {
      admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
    }
  }
  finished = true
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => {
  console.error("FAIL (crashed)", e)
  process.exit(1)
})
