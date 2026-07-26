import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey } from "@/lib/api-rate-limit"
import { getCurrentBattle } from "@/lib/pulse/battle-engine"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/pulse/battle/current — live / due / flash battle payload.
 * Bootstraps schema + live battle when missing (first hit after deploy).
 */
export async function GET(req: Request) {
  try {
    await ensurePulseBattleSchema()
    const session = await auth()
    const key = rateLimitClientKey(req, session?.user?.id)
    const ip = key.startsWith("ip:") ? key.slice(3) : null

    const battle = await getCurrentBattle({
      userId: session?.user?.id ?? null,
      ip,
    })
    return NextResponse.json({ ok: true, battle })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("[pulse-battle/current]", { result: "error", error: msg })
    if (msg === "NO_BATTLE_PRODUCTS") {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_BATTLE_PRODUCTS",
          message: "Pas assez de produits listés pour lancer un duel",
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { ok: false, error: "battle_unavailable", message: msg.slice(0, 160) },
      { status: 500 }
    )
  }
}
