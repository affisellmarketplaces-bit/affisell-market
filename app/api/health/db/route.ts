import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PendingCountRow = { pending: bigint | number }

/**
 * Public liveness probe for the database. It deliberately returns NO migration names, ids or raw error messages
 * (finalisation master doc, C4): only whether the database answers and how many migrations are still unfinished.
 * Details go to the server log. For the full schema check use `npm run schema:verify` (read-only, run by the owner).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const rows = await prisma.$queryRaw<PendingCountRow[]>`
      SELECT COUNT(*) AS pending FROM "_prisma_migrations" WHERE finished_at IS NULL
    `

    return NextResponse.json({ ok: true, pendingMigrationsCount: Number(rows[0]?.pending ?? 0) })
  } catch (error: unknown) {
    console.error("[health/db]", {
      result: "error",
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
