import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  createScheduledBattle,
  nextParisBattleSlot,
} from "@/lib/pulse/battle-engine"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET|POST /api/pulse/battle/create — schedule tomorrow 18h Paris battle.
 * Auth: Bearer CRON_SECRET (Vercel cron 16:00 UTC ≈ 18h Paris).
 */
async function handle(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const slot = nextParisBattleSlot()
  const existing = await prisma.pulseBattle.findFirst({
    where: {
      status: "scheduled",
      scheduledAt: {
        gte: new Date(slot.getTime() - 2 * 3600_000),
        lte: new Date(slot.getTime() + 2 * 3600_000),
      },
    },
    select: { id: true, scheduledAt: true },
  })
  if (existing) {
    console.log("[pulse-battle/create]", {
      result: "idempotent_skip",
      battleId: existing.id,
    })
    return NextResponse.json({
      ok: true,
      skipped: true,
      battleId: existing.id,
      scheduledAt: existing.scheduledAt.toISOString(),
    })
  }

  const battle = await createScheduledBattle(slot)
  if (!battle) {
    return NextResponse.json({ ok: false, error: "NO_BATTLE_PRODUCTS" }, { status: 503 })
  }
  return NextResponse.json({
    ok: true,
    battleId: battle.id,
    scheduledAt: battle.scheduledAt.toISOString(),
  })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
