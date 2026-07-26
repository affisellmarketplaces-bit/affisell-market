import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { BattleVoteError, voteBattle } from "@/lib/pulse/battle-engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/pulse/battle/vote — one vote per user or IP per battle.
 */
export async function POST(req: Request) {
  const session = await auth()
  const limited = await rateLimitResponseAsync(
    rateLimitClientKey(req, session?.user?.id),
    { limit: 5, windowMs: 60_000, prefix: "pulse-battle-vote" }
  )
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as {
    battleId?: string
    productId?: string
  }
  const battleId = typeof body.battleId === "string" ? body.battleId.trim() : ""
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!battleId || !productId) {
    return NextResponse.json({ error: "Missing battleId or productId" }, { status: 400 })
  }

  const key = rateLimitClientKey(req, session?.user?.id)
  const ip = key.startsWith("ip:") ? key.slice(3) : key.startsWith("user:") ? null : "unknown"

  try {
    const tallies = await voteBattle({
      battleId,
      productId,
      userId: session?.user?.id ?? null,
      ip: session?.user?.id ? null : ip,
    })
    return NextResponse.json({ ok: true, ...tallies })
  } catch (e) {
    if (e instanceof BattleVoteError) {
      const status =
        e.message === "ALREADY_VOTED"
          ? 409
          : e.message === "BATTLE_NOT_FOUND"
            ? 404
            : 400
      return NextResponse.json({ ok: false, error: e.message }, { status })
    }
    console.log("[pulse-battle/vote]", {
      result: "error",
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ ok: false, error: "vote_failed" }, { status: 500 })
  }
}
