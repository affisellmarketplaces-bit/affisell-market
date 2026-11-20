import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierQualityRecommendations } from "@/lib/listing-quality/quality-effect.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, read-only: which of ITS OWN live sheets lack an element that, on Affisell, goes with more sales per day of
 * presence in a shop (same category, price band and age — an association, not a promise). The evidence is the
 * marketplace AGGREGATE (≥ 5 suppliers on each side); nothing about another supplier or a reseller is returned.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "listing-quality", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  try {
    const { report, recommendations } = await loadSupplierQualityRecommendations(session.user.id)
    return NextResponse.json({
      windowDays: report.windowDays,
      generatedAt: report.generatedAt,
      // Only the elements with an established association — the aggregate figures, no counts per supplier.
      evidence: report.effects
        .filter((e) => e.verdict === "positive")
        .map((e) => ({ feature: e.feature, adjustedRatio: e.estimated.adjustedRatio, lo: e.estimated.lo, hi: e.estimated.hi })),
      recommendations,
      limits: report.limits,
    })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
