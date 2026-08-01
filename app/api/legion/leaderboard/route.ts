import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { fetchLegionLeaderboard } from "@/lib/legion/leaderboard"
import { expireLegionBoosts } from "@/lib/legion/expire-boosts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/legion/leaderboard?boost_id=&product_id=
 * Public real-time Battle sales ranking (top 20).
 */
export async function GET(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "legion-leaderboard",
    limit: 60,
    windowMs: 60 * 1000,
  })
  if (limited) return limited

  await expireLegionBoosts()

  const url = new URL(req.url)
  const boostId = url.searchParams.get("boost_id")
  const productId = url.searchParams.get("product_id")

  try {
    const { leaderboard, fallback } = await fetchLegionLeaderboard({
      boostId,
      productId,
      limit: 20,
    })

    console.log("[legion-leaderboard]", {
      result: "ok",
      rows: leaderboard.length,
      fallback,
      boostId: boostId ?? null,
      productId: productId ?? null,
    })

    return NextResponse.json({
      ok: true,
      leaderboard: leaderboard.map((row) => ({
        boost_id: row.boostId,
        product_id: row.productId,
        product_title: row.productTitle,
        boost_margin_rate: row.boostMarginRate,
        ends_at: row.endsAt,
        username: row.username,
        display_name: row.displayName,
        avatar_url: row.avatarUrl,
        sales_count: row.salesCount,
        total_gmv: row.totalGmv,
        total_earnings: row.totalEarnings,
      })),
      fallback,
    })
  } catch (err) {
    console.error("[legion-leaderboard]", {
      result: "error",
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ ok: true, leaderboard: [], fallback: true })
  }
}
