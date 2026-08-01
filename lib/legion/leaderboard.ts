import "server-only"

import { prisma } from "@/lib/prisma"

export type LegionLeaderboardRow = {
  boostId: string
  productId: string
  productTitle: string
  boostMarginRate: number
  endsAt: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  salesCount: number
  totalGmv: number
  totalEarnings: number
}

type ViewRow = {
  boost_id: string
  product_id: string
  product_title: string | null
  boost_margin_rate: unknown
  ends_at: Date
  username: string
  display_name: string | null
  avatar_url: string | null
  sales_count: number
  total_gmv: unknown
  total_earnings: unknown
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    try {
      return Number((value as { toNumber: () => number }).toNumber())
    } catch {
      return 0
    }
  }
  return 0
}

function mapViewRow(row: ViewRow): LegionLeaderboardRow {
  return {
    boostId: row.boost_id,
    productId: row.product_id,
    productTitle: row.product_title?.trim() || "Product",
    boostMarginRate: num(row.boost_margin_rate),
    endsAt: row.ends_at instanceof Date ? row.ends_at.toISOString() : String(row.ends_at),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    salesCount: Math.max(0, Math.floor(Number(row.sales_count) || 0)),
    totalGmv: num(row.total_gmv),
    totalEarnings: num(row.total_earnings),
  }
}

/**
 * Real-time Légion Battle leaderboard.
 * Prefers SQL view `legion_leaderboard`; falls back to Prisma aggregation if view missing.
 */
export async function fetchLegionLeaderboard(args: {
  boostId?: string | null
  productId?: string | null
  limit?: number
}): Promise<{ leaderboard: LegionLeaderboardRow[]; fallback: boolean }> {
  const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 20)))
  const boostId = args.boostId?.trim() || null
  const productId = args.productId?.trim() || null

  try {
    const rows = await prisma.$queryRawUnsafe<ViewRow[]>(
      `
      SELECT *
      FROM legion_leaderboard
      WHERE ($1::text IS NULL OR boost_id = $1)
        AND ($2::text IS NULL OR product_id = $2)
      ORDER BY sales_count DESC, total_gmv DESC
      LIMIT $3
      `,
      boostId,
      productId,
      limit
    )
    return { leaderboard: rows.map(mapViewRow), fallback: false }
  } catch (viewErr) {
    console.warn("[legion-leaderboard]", {
      result: "view_unavailable",
      error: viewErr instanceof Error ? viewErr.message : String(viewErr),
    })
  }

  try {
    const leaderboard = await fetchLegionLeaderboardViaPrisma({
      boostId,
      productId,
      limit,
    })
    return { leaderboard, fallback: true }
  } catch (fallbackErr) {
    console.error("[legion-leaderboard]", {
      result: "fallback_failed",
      error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
    })
    return { leaderboard: [], fallback: true }
  }
}

async function fetchLegionLeaderboardViaPrisma(args: {
  boostId: string | null
  productId: string | null
  limit: number
}): Promise<LegionLeaderboardRow[]> {
  const boosts = await prisma.legionBoost.findMany({
    where: {
      status: "active",
      ...(args.boostId ? { id: args.boostId } : {}),
      ...(args.productId ? { productId: args.productId } : {}),
    },
    select: {
      id: true,
      productId: true,
      productTitle: true,
      boostMarginRate: true,
      startsAt: true,
      endsAt: true,
    },
    take: 20,
  })

  if (boosts.length === 0) return []

  const aggregated: LegionLeaderboardRow[] = []

  for (const boost of boosts) {
    const orders = await prisma.order.findMany({
      where: {
        productId: boost.productId,
        storeProfileId: { not: null },
        paidAt: { gte: boost.startsAt, lte: boost.endsAt },
        payoutStatus: { not: "FAILED" },
        status: { not: "refunded" },
      },
      select: {
        sellingPriceCents: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        storeProfile: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    const byUser = new Map<
      string,
      {
        username: string
        displayName: string | null
        avatarUrl: string | null
        salesCount: number
        totalGmvCents: number
        totalEarningsCents: number
      }
    >()

    for (const order of orders) {
      const profile = order.storeProfile
      if (!profile) continue
      const key = profile.username
      const prev = byUser.get(key) ?? {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        salesCount: 0,
        totalGmvCents: 0,
        totalEarningsCents: 0,
      }
      prev.salesCount += 1
      prev.totalGmvCents += order.sellingPriceCents
      prev.totalEarningsCents +=
        order.affiliatePayoutCents + order.affiliateMarginRetainedCents
      byUser.set(key, prev)
    }

    for (const row of byUser.values()) {
      aggregated.push({
        boostId: boost.id,
        productId: boost.productId,
        productTitle: boost.productTitle?.trim() || "Product",
        boostMarginRate: Number(boost.boostMarginRate),
        endsAt: boost.endsAt.toISOString(),
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        salesCount: row.salesCount,
        totalGmv: Math.round(row.totalGmvCents) / 100,
        totalEarnings: Math.round(row.totalEarningsCents) / 100,
      })
    }
  }

  return aggregated
    .sort((a, b) => b.salesCount - a.salesCount || b.totalGmv - a.totalGmv)
    .slice(0, args.limit)
}
