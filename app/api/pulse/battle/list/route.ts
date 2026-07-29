import { NextResponse } from "next/server"

import { loadBattlesHub } from "@/lib/battles-hub-data.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/pulse/battle/list — buyer hub: live + upcoming + recent (no auto-create).
 */
export async function GET() {
  try {
    const payload = await loadBattlesHub()
    return NextResponse.json(
      { ok: true, ...payload },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("[pulse-battle/list]", { result: "error", error: msg })
    return NextResponse.json(
      { ok: false, error: "battles_unavailable", message: msg.slice(0, 160) },
      { status: 500 }
    )
  }
}
