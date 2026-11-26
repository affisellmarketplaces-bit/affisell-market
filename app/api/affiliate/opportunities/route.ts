import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadOpportunityBoard } from "@/lib/intelligence/opportunities.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/opportunities?limit=50 — the sales-based opportunity board (lib/intelligence/opportunities.ts):
 * products ranked by what the platform's real paid orders of the last 30 days earned per reseller, net of the refunds and
 * returns observed, with every factor's source and sample size. Reseller or admin session. Read-only.
 */
export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (role !== "AFFILIATE" && role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    prefix: "affiliate-opportunities",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited

  const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? "50")
  const board = await loadOpportunityBoard({
    viewerAffiliateId: role === "AFFILIATE" ? userId : null,
    limit: Number.isFinite(limitRaw) ? limitRaw : 50,
  })
  return NextResponse.json(board)
}
