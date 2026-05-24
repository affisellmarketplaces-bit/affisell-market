import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PendingMigrationRow = {
  id: string
  migration_name: string
  started_at: Date
  finished_at: Date | null
  applied_steps_count: number
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const pending = await prisma.$queryRaw<PendingMigrationRow[]>`
      SELECT id, migration_name, started_at, finished_at, applied_steps_count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
    `

    return NextResponse.json({
      ok: true,
      pendingMigrations: pending.map((row) => ({
        id: row.id,
        migrationName: row.migration_name,
        startedAt: row.started_at,
        appliedStepsCount: row.applied_steps_count,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
