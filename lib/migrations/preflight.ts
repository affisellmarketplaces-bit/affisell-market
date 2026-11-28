/**
 * Migration preflight — READ-ONLY checks BEFORE applying one migration to a database (staging first, then production).
 * Answers PASS or BLOCKED, with the evidence for each check. Never writes: the CLI opens a session the database server
 * keeps read-only, and this module only issues SELECT / SHOW.
 *
 * What `prisma migrate deploy` would REALLY do is "apply every pending migration", so the first thing proven is that
 * the pending set is exactly the one expected — not just that the target migration is pending.
 */
import { createHash } from "node:crypto"

export type RawDb = { $queryRawUnsafe<R = unknown>(sql: string, ...values: unknown[]): Promise<R> }

export type CheckStatus = "PASS" | "BLOCKED" | "MANUAL" | "INFO"
export type Check = { id: string; status: CheckStatus; evidence: string }
export type PreflightResult = { verdict: "PASS" | "BLOCKED"; checks: Check[] }

export const PRISMA_MIGRATION_LOCK_KEY = 72707369

/** Prisma records the SHA-256 (hex) of migration.sql in `_prisma_migrations.checksum`. */
export const migrationChecksum = (sql: string | Buffer) => createHash("sha256").update(sql).digest("hex")

export type PreflightInput = {
  migration: string
  /** sha256 of the local migration.sql (what `migrate deploy` would record). */
  localChecksum: string
  /** Every migration directory in the repository, sorted. */
  localMigrations: string[]
  /** The database endpoint the URL names, and the one the operator expects (Neon `ep-…`). */
  urlEndpoint: string
  expectEndpoint: string
  /** Tables the migration creates: must not exist yet. */
  createsTables: string[]
  /** Did the operator confirm a backup (Neon branch)? It cannot be verified from SQL. */
  backupConfirmed: string | null
}

type MigrationRow = {
  migration_name: string
  checksum: string
  finished_at: Date | string | null
  rolled_back_at: Date | string | null
}

export async function runMigrationPreflight(db: RawDb, input: PreflightInput): Promise<PreflightResult> {
  const checks: Check[] = []
  const add = (id: string, status: CheckStatus, evidence: string) => checks.push({ id, status, evidence })

  // 1. Target identity — from the URL, then from the server itself when it says (Neon exposes neon.endpoint_id).
  if (!input.expectEndpoint || input.urlEndpoint !== input.expectEndpoint) {
    add(
      "target.endpoint",
      "BLOCKED",
      `URL names "${input.urlEndpoint}", expected "${input.expectEndpoint || "(not given)"}"`,
    )
  } else add("target.endpoint", "PASS", `URL names ${input.urlEndpoint}`)
  try {
    const [row] = await db.$queryRawUnsafe<Array<{ ep: string | null; db: string; ro: string }>>(
      `SELECT current_setting('neon.endpoint_id', true) AS "ep", current_database() AS "db", current_setting('default_transaction_read_only') AS "ro"`,
    )
    if (row?.ep && row.ep !== input.expectEndpoint) add("target.server", "BLOCKED", `server says endpoint ${row.ep}`)
    else
      add(
        "target.server",
        row?.ep ? "PASS" : "INFO",
        `database ${row?.db}${row?.ep ? `, server endpoint ${row.ep}` : ", server does not report an endpoint id"}`,
      )
    add("session.read_only", row?.ro === "on" ? "PASS" : "BLOCKED", `default_transaction_read_only=${row?.ro}`)
  } catch (e) {
    add("target.server", "BLOCKED", `cannot query the server: ${msg(e)}`)
    return finish(checks)
  }

  // 2. Migration history.
  const [{ exists }] = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS "exists"`,
  )
  if (!exists) {
    add("history.table", "BLOCKED", "_prisma_migrations does not exist: this database is not managed by Prisma Migrate")
    return finish(checks)
  }
  const rows = await db.$queryRawUnsafe<MigrationRow[]>(
    `SELECT "migration_name", "checksum", "finished_at", "rolled_back_at" FROM "_prisma_migrations" ORDER BY "migration_name"`,
  )
  const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at)
  add(
    "history.failed",
    failed.length === 0 ? "PASS" : "BLOCKED",
    failed.length === 0
      ? "no failed migration"
      : `failed: ${failed.map((r) => r.migration_name).join(", ")} (resolve --rolled-back first)`,
  )
  const applied = new Set(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name))
  const unknown = [...applied].filter((n) => !input.localMigrations.includes(n))
  add(
    "history.diverged",
    unknown.length === 0 ? "PASS" : "BLOCKED",
    unknown.length === 0
      ? "every applied migration exists in the repository"
      : `applied but not in the repository: ${unknown.join(", ")}`,
  )
  const pending = input.localMigrations.filter((n) => !applied.has(n))
  add(
    "history.pending_exactly_one",
    pending.length === 1 && pending[0] === input.migration ? "PASS" : "BLOCKED",
    `pending: ${pending.length === 0 ? "none" : pending.join(", ")} — \`migrate deploy\` applies ALL of them`,
  )

  // 3. Checksum: no different version of THIS migration was ever recorded.
  const mine = rows.filter((r) => r.migration_name === input.migration)
  const otherChecksum = mine.find((r) => r.checksum !== input.localChecksum)
  if (otherChecksum) {
    add(
      "checksum",
      "BLOCKED",
      `a row with checksum ${otherChecksum.checksum.slice(0, 12)}… exists (local ${input.localChecksum.slice(0, 12)}…): another version was applied or attempted — do not re-apply, write a forward migration`,
    )
  } else {
    add(
      "checksum",
      "PASS",
      `local sha256 ${input.localChecksum}${mine.length ? " (matching row present)" : ", never recorded"}`,
    )
  }

  // 4. The objects it creates do not exist yet (nobody created them by hand).
  for (const table of input.createsTables) {
    const [{ t }] = await db.$queryRawUnsafe<Array<{ t: string | null }>>(
      `SELECT to_regclass($1)::text AS "t"`,
      `"${table}"`,
    )
    add(
      `object.${table}`,
      t ? "BLOCKED" : "PASS",
      t ? `${table} already exists while the migration is not applied` : `${table} absent`,
    )
  }

  // 5. Nothing would block or fight the DDL: Prisma's migration lock, old open transactions.
  const [{ lock }] = await db.$queryRawUnsafe<Array<{ lock: number }>>(
    `SELECT count(*)::int AS "lock" FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND granted`,
    PRISMA_MIGRATION_LOCK_KEY,
  )
  add(
    "locks.prisma_migration",
    lock === 0 ? "PASS" : "BLOCKED",
    lock === 0 ? "Prisma's migration lock is free" : "another migrate run holds Prisma's lock",
  )
  const [{ old }] = await db.$queryRawUnsafe<Array<{ old: number }>>(
    `SELECT count(*)::int AS "old" FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
     AND xact_start IS NOT NULL AND xact_start < now() - interval '10 minutes'`,
  )
  add(
    "locks.long_transactions",
    old === 0 ? "PASS" : "INFO",
    `${old} transaction(s) open for more than 10 min (a new table does not wait on them)`,
  )

  // 6. Backup: not provable from SQL.
  add(
    "backup",
    input.backupConfirmed ? "MANUAL" : "BLOCKED",
    input.backupConfirmed
      ? `operator states the Neon branch "${input.backupConfirmed}" exists (not verifiable from SQL — check it in the Neon console)`
      : "no backup stated: create a Neon branch first, then pass --backup-branch <name>",
  )
  return finish(checks)
}

function finish(checks: Check[]): PreflightResult {
  return { verdict: checks.some((c) => c.status === "BLOCKED") ? "BLOCKED" : "PASS", checks }
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

export function formatPreflight(r: PreflightResult): string {
  const icon = { PASS: "✓", BLOCKED: "✗", MANUAL: "!", INFO: "·" } as const
  return [
    ...r.checks.map((c) => `${icon[c.status]} ${c.status.padEnd(7)} ${c.id.padEnd(28)} ${c.evidence}`),
    `VERDICT: ${r.verdict}`,
  ].join("\n")
}
