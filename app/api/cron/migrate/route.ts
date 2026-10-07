import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 10

const MIGRATION_NAME_RE = /^\d{14}_[a-z0-9_]+$/i

type MigrationRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }

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

/**
 * READ-ONLY diagnostic of the migration history: which migrations of this deployment are applied, pending or FAILED.
 *
 * It used to apply pending migrations at runtime (statement by statement, without a transaction, swallowing "already exists"
 * errors) and to mark every unfinished migration as finished — i.e. to record a migration that had FAILED as applied without
 * having run it. It now writes nothing. Migrations are deployed by `npm run schema:migrate` (and, on Vercel, by the schema
 * step of scripts/vercel-build.mjs, which hard-fails); see docs/DEPLOY-SCHEMA-CHANGES.md.
 *
 * `Authorization: Bearer ${CRON_SECRET}`. 200 when nothing is pending or failed, 503 otherwise (so a scheduler notices).
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 })
  }

  const folders = listLocalMigrationFolders(join(process.cwd(), "prisma", "migrations"))

  try {
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `
    const applied = new Set(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name))
    const failed = rows
      .filter((r) => !r.finished_at && !r.rolled_back_at)
      .map((r) => r.migration_name)
      .sort()
    const pending = folders.filter((name) => !applied.has(name) && !failed.includes(name))
    const ok = pending.length === 0 && failed.length === 0

    console.log("[cron/migrate]", { result: ok ? "up_to_date" : "behind", applied: applied.size, pending, failed })
    return NextResponse.json(
      {
        ok,
        mode: "read-only diagnostic",
        applied: applied.size,
        local: folders.length,
        pending,
        failed,
        hint: ok ? undefined : "Deploy with `npm run schema:migrate`; a FAILED migration needs the manual procedure in docs/DEPLOY-SCHEMA-CHANGES.md §6.",
      },
      { status: ok ? 200 : 503 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.log("[cron/migrate]", { result: "error", error: message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
