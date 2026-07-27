import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RegclassRow = { to_regclass: string | null }

/**
 * Lightweight schema probe — Ghost + Pulse battle tables (no auth).
 * Use after deploy to confirm migrations caught up vs cron backup.
 */
export async function GET() {
  try {
    const checks = await Promise.all([
      prisma.$queryRaw<RegclassRow[]>`SELECT to_regclass('public."PulseBattle"')`,
      prisma.$queryRaw<RegclassRow[]>`SELECT to_regclass('public."StockCheckLog"')`,
    ])

    return NextResponse.json({
      battle: Boolean(checks[0]?.[0]?.to_regclass),
      ghost: Boolean(checks[1]?.[0]?.to_regclass),
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.log("[health/migrations]", { result: "error", error: message })
    return NextResponse.json(
      {
        battle: false,
        ghost: false,
        timestamp: new Date().toISOString(),
        error: message,
      },
      { status: 503 }
    )
  }
}
