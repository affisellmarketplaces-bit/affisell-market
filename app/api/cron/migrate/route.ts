import { createHash, randomUUID } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { isBenignMigrationError, splitPostgresMigrationSql } from "@/lib/cron/migrate-sql"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MIGRATION_NAME_RE = /^\d{14}_[a-z0-9_]+$/i

type AppliedMigrationRow = { migration_name: string }

function listLocalMigrationFolders(migrationsDir: string): string[] {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir)
    .filter((name) => {
      if (!MIGRATION_NAME_RE.test(name)) return false
      try {
        return statSync(join(migrationsDir, name)).isDirectory()
      } catch {
        return false
      }
    })
    .sort()
}

function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex")
}

async function healFailedMigrationHistory(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "_prisma_migrations"
    SET
      finished_at = COALESCE(finished_at, started_at, NOW()),
      applied_steps_count = GREATEST(COALESCE(applied_steps_count, 0), 1),
      logs = NULL
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
  `
}

async function loadAppliedMigrationNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<AppliedMigrationRow[]>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
    ORDER BY finished_at
  `
  return new Set(rows.map((row) => row.migration_name))
}

async function markMigrationApplied(migrationName: string, checksum: string): Promise<void> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "_prisma_migrations"
    WHERE migration_name = ${migrationName}
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
    LIMIT 1
  `
  if (existing.length > 0) return

  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (
      id,
      checksum,
      finished_at,
      migration_name,
      logs,
      rolled_back_at,
      started_at,
      applied_steps_count
    )
    VALUES (
      ${randomUUID()},
      ${checksum},
      NOW(),
      ${migrationName},
      NULL,
      NULL,
      NOW(),
      1
    )
  `
}

async function applyMigrationSql(migrationName: string, sql: string): Promise<string> {
  const checksum = migrationChecksum(sql)
  const statements = splitPostgresMigrationSql(sql)
  if (statements.length === 0) {
    await markMigrationApplied(migrationName, checksum)
    return `⚠ ${migrationName} empty SQL, marked done`
  }

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement)
    } catch (error: unknown) {
      if (!isBenignMigrationError(error)) throw error
    }
  }

  await markMigrationApplied(migrationName, checksum)
  return `✓ ${migrationName} applied`
}

/**
 * Apply pending Prisma migrations via raw SQL (no Prisma CLI — Vercel lambda safe).
 * Primary path remains build-time migrate deploy; this cron is the daily backup.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 })
  }

  const migrationsDir = join(process.cwd(), "prisma", "migrations")
  const folders = listLocalMigrationFolders(migrationsDir)

  try {
    await healFailedMigrationHistory()
    const appliedNames = await loadAppliedMigrationNames()
    const pending = folders.filter((name) => !appliedNames.has(name))

    if (pending.length === 0) {
      console.log("[cron/migrate]", {
        result: "up_to_date",
        applied: folders.length,
      })
      return NextResponse.json({
        ok: true,
        output: "No pending migrations",
        applied: folders.length,
        pending: 0,
      })
    }

    const lines: string[] = [`Pending: ${pending.length}`]

    for (const migrationName of pending) {
      const sqlPath = join(migrationsDir, migrationName, "migration.sql")
      if (!existsSync(sqlPath)) {
        lines.push(`⚠ ${migrationName} skipped (no migration.sql)`)
        continue
      }

      const sql = readFileSync(sqlPath, "utf8")
      lines.push(`--- Applying ${migrationName} ---`)

      try {
        const line = await applyMigrationSql(migrationName, sql)
        lines.push(line)
      } catch (error: unknown) {
        if (isBenignMigrationError(error)) {
          const checksum = migrationChecksum(sql)
          await markMigrationApplied(migrationName, checksum)
          lines.push(`⚠ ${migrationName} already exists, marked done`)
          continue
        }
        throw error
      }
    }

    const output = lines.join("\n")
    console.log("[cron/migrate]", {
      result: "applied",
      pending: pending.length,
      outputTail: output.slice(-500),
    })

    return NextResponse.json({
      ok: true,
      output,
      pending: pending.length,
      applied: folders.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.log("[cron/migrate]", { result: "error", error: message })
    return NextResponse.json(
      {
        ok: false,
        output: stack ? `${message}\n${stack}` : message,
        exitCode: 1,
      },
      { status: 500 }
    )
  }
}
