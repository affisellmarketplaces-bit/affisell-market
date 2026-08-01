import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { calculateBoostUrgency, formatBoostMessage } from "@/lib/legion/boost"
import { expireLegionBoosts } from "@/lib/legion/expire-boosts"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/legion/boost/active
 * Public list of live BOOST battles (expires overdue rows lazily).
 */
export async function GET(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "legion-boost-active",
    limit: 60,
    windowMs: 60 * 1000,
  })
  if (limited) return limited

  // Lazy expire so banner never shows stale battles if cron lags.
  await expireLegionBoosts()

  const now = new Date()
  const rows = await prisma.legionBoost.findMany({
    where: { status: "active", endsAt: { gt: now } },
    orderBy: { endsAt: "asc" },
    take: 10,
    select: {
      id: true,
      productId: true,
      productTitle: true,
      boostMarginRate: true,
      oldMarginRate: true,
      startsAt: true,
      endsAt: true,
      armyNotifiedCount: true,
      boostSalesCount: true,
    },
  })

  const boosts = rows.map((row) => {
    const urgency = calculateBoostUrgency(row.endsAt, now)
    const title = row.productTitle?.trim() || "Produit"
    const rate = Number(row.boostMarginRate)
    return {
      id: row.id,
      product_id: row.productId,
      product_title: title,
      boost_margin_rate: rate,
      old_margin_rate: Number(row.oldMarginRate),
      starts_at: row.startsAt.toISOString(),
      ends_at: row.endsAt.toISOString(),
      army_notified_count: row.armyNotifiedCount,
      boost_sales_count: row.boostSalesCount,
      minutes_left: urgency.minutesLeft,
      progress: urgency.progress,
      is_critical: urgency.isCritical,
      message: formatBoostMessage({
        productTitle: title,
        boostMarginRate: rate,
        minutesLeft: urgency.minutesLeft,
      }),
    }
  })

  return NextResponse.json({ ok: true, boosts })
}
