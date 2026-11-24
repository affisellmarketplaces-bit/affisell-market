import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadListingPlanStatus } from "@/lib/reseller-copilot/observation-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/listings/:id/observation-plan — where the observation plan of ONE of the reseller's own listings
 * stands: listed days really elapsed, sales, availability today, what is not measured, the horizon (initial and
 * re-measured) and — only once it is reached — one recommendation. `{ view: null }` when there is no plan, the
 * listing is not the reseller's, or `OBSERVATION_PLAN_MODE` is not `on`. Never blocks anything.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { prefix: "observation-plan-status", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  const { id } = await ctx.params
  const view = await loadListingPlanStatus(userId, id)
  return NextResponse.json({ view }, { headers: { "Cache-Control": "no-store" } })
}
