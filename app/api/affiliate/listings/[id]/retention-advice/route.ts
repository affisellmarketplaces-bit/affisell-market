import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadRetentionAdvice } from "@/lib/reseller-copilot/retention-advisor.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/listings/:id/retention-advice — Smart Retention Advisor, asked when the signed-in reseller opens
 * the withdrawal confirmation of ONE of its own listings. `{ advice: null }` whenever nothing reliable can be said
 * (and always while `RETENTION_ADVISOR_MODE` is off / observe). Another reseller's listing answers 404. Aggregates only:
 * no other reseller, no sales figure, no amount. Never blocks the withdrawal (the client confirms without waiting).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { prefix: "retention-advice", limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { id } = await ctx.params
  const result = await loadRetentionAdvice(userId, id)
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ advice: result.advice }, { headers: { "Cache-Control": "no-store" } })
}
