import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { endBattle } from "@/lib/pulse/battle-engine"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

async function requireBattleOwner(battleId: string, userId: string, role: string) {
  const battle = await prisma.pulseBattle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      status: true,
      productAId: true,
      productBId: true,
      flashDiscountSetBy: true,
    },
  })
  if (!battle) return { battle: null as never, err: "Battle not found", code: 404 }
  if (role === "ADMIN") return { battle, err: null, code: 0 }
  if (battle.flashDiscountSetBy === userId) return { battle, err: null, code: 0 }
  const owns = await prisma.affiliateProduct.findFirst({
    where: {
      affiliateId: userId,
      isListed: true,
      productId: { in: [battle.productAId, battle.productBId] },
    },
    select: { id: true },
  })
  if (!owns) return { battle: null as never, err: "Forbidden", code: 403 }
  return { battle, err: null, code: 0 }
}

/**
 * POST /api/pulse/battle/[id]/end — manually end a live battle.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  await ensurePulseBattleSchema()
  const session = await auth()
  const userId = session?.user?.id?.trim() || ""
  const role = String(session?.user?.role ?? "").toUpperCase()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "AFFILIATE" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id: battleId } = await ctx.params
  if (!battleId?.trim()) return NextResponse.json({ error: "battleId required" }, { status: 400 })

  const { battle, err, code } = await requireBattleOwner(battleId.trim(), userId, role)
  if (err) return NextResponse.json({ error: err }, { status: code })

  if (battle.status === "ended") {
    return NextResponse.json({ ok: true, alreadyEnded: true, battleId: battle.id })
  }
  if (battle.status !== "live" && battle.status !== "scheduled") {
    return NextResponse.json({ error: "Battle cannot be ended in this state" }, { status: 400 })
  }

  if (battle.status === "scheduled") {
    await prisma.pulseBattle.update({
      where: { id: battle.id },
      data: { status: "ended", endedAt: new Date(), winnerId: null },
    })
    console.log("[pulse-battle/end]", { result: "scheduled_cancelled", battleId: battle.id, userId })
    return NextResponse.json({ ok: true, battleId: battle.id, cancelled: true })
  }

  const winnerId = await endBattle(battle.id)
  console.log("[pulse-battle/end]", { result: "ended", battleId: battle.id, winnerId, userId })
  return NextResponse.json({ ok: true, battleId: battle.id, winnerId })
}

/**
 * DELETE /api/pulse/battle/[id]/end — hard delete a battle (before or after).
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  await ensurePulseBattleSchema()
  const session = await auth()
  const userId = session?.user?.id?.trim() || ""
  const role = String(session?.user?.role ?? "").toUpperCase()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "AFFILIATE" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id: battleId } = await ctx.params
  if (!battleId?.trim()) return NextResponse.json({ error: "battleId required" }, { status: 400 })

  const { err, code } = await requireBattleOwner(battleId.trim(), userId, role)
  if (err) return NextResponse.json({ error: err }, { status: code })

  await prisma.pulseBattleVote.deleteMany({ where: { battleId: battleId.trim() } }).catch(() => {})
  await prisma.pulseBattle.delete({ where: { id: battleId.trim() } })
  console.log("[pulse-battle/delete]", { result: "deleted", battleId: battleId.trim(), userId })
  return NextResponse.json({ ok: true, deleted: true })
}
