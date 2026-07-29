import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { applyResellerBattleContender } from "@/lib/pulse/battle-contender"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/pulse/battle/[id]/contender
 * Reseller picks which of their listed products fights in the Battle.
 * Body: { listingId: string }
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  await ensurePulseBattleSchema()

  const session = await auth()
  const userId = session?.user?.id?.trim() || ""
  const role = String(session?.user?.role ?? "").toUpperCase()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (role !== "AFFILIATE" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: battleId } = await ctx.params
  if (!battleId?.trim()) {
    return NextResponse.json({ error: "battleId required" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { listingId?: unknown }
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : ""
  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 })
  }

  const applied = await applyResellerBattleContender({
    battleId: battleId.trim(),
    userId,
    listingId,
    role,
  })
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: applied.status })
  }

  return NextResponse.json({ ok: true, contender: applied.result })
}
