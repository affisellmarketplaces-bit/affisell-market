import { NextResponse } from "next/server"

import { syncMarketIntelligenceFixtures } from "@/lib/ai/market-intelligence"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Cron: 0 */6 * * * — re-writes the 3 hand-written demo fixtures as market:{product_key} (TTL 6h). It fetches no market data:
// the response says `origin: "fixture", live: false`.
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await syncMarketIntelligenceFixtures()
  return NextResponse.json({ ok: true, ...result })
}
