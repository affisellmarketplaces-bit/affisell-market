import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadListingPresence } from "@/lib/listing-presence/presence.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/listings/:id/presence — the life of ONE of the signed-in reseller's own listings in its shop:
 * periods on sale (exact, or with an unknown start for a listing older than the history), withdrawals, relistings, gaps
 * and the cumulative listed time. Another reseller's listing answers 404, exactly like a listing that does not exist.
 * Read-only. Never exposes the actor id. A database without the migration answers `available: false`.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { prefix: "listing-presence", limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const { id } = await ctx.params
  const result = await loadListingPresence(userId, id)
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (!result.available) return NextResponse.json({ available: false, listingId: result.listingId })
  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  return NextResponse.json({
    available: true,
    listingId: result.listingId,
    trackingStartedAt: iso(result.trackingStartedAt),
    status: result.history.status,
    periods: result.history.periods.map((p) => ({
      start: iso(p.start),
      startKnown: p.startKnown,
      startLowerBound: iso(p.startLowerBound),
      end: iso(p.end),
      ongoing: p.ongoing,
      uncertain: p.uncertain,
    })),
    summary: { ...result.summary, observedFrom: iso(result.summary.observedFrom) },
    gapsDays: result.history.gapsDays,
  })
}
