import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  createLiveBattleNow,
  createScheduledBattle,
  nextParisBattleSlot,
} from "@/lib/pulse/battle-engine"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET|POST /api/pulse/battle/create — schedule tomorrow 18h Paris battle.
 * Auth: Bearer CRON_SECRET (Vercel cron 16:00 UTC ≈ 18h Paris).
 * Query `?live=1` also bootstraps an immediate live battle (ops / first deploy).
 */
async function handle(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  await ensurePulseBattleSchema()

  const url = new URL(req.url)
  const wantLive = url.searchParams.get("live") === "1"

  let liveId: string | null = null
  if (wantLive) {
    const existingLive = await prisma.pulseBattle.findFirst({
      where: { status: "live" },
      select: { id: true },
    })
    if (existingLive) {
      liveId = existingLive.id
    } else {
      const live = await createLiveBattleNow()
      liveId = live?.id ?? null
    }
  }

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
      liveId,
    })
    return NextResponse.json({
      ok: true,
      skipped: true,
      battleId: existing.id,
      liveId,
      scheduledAt: existing.scheduledAt.toISOString(),
    })
  }

  const battle = await createScheduledBattle(slot)
  if (!battle && !liveId) {
    return NextResponse.json({ ok: false, error: "NO_BATTLE_PRODUCTS" }, { status: 503 })
  }
  return NextResponse.json({
    ok: true,
    battleId: battle?.id ?? null,
    liveId,
    scheduledAt: battle?.scheduledAt.toISOString() ?? null,
  })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
