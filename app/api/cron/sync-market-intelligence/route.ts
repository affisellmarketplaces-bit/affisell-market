import { NextResponse } from "next/server"

import { syncMarketIntelligenceFixtures } from "@/lib/ai/market-intelligence"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Cron `0 */6 * * *` — refresh market:{product_key} snapshots (TTL 6h). */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await syncMarketIntelligenceFixtures()
  return NextResponse.json({ ok: true, ...result })
}
