import "server-only"

import type { AffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics-types"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { addDays } from "@/lib/order-payout-policy"
import { prisma } from "@/lib/prisma"

export const AFFILIATE_ANALYTICS_WINDOW_DAYS = 30
export const AFFILIATE_ANALYTICS_TOP_EPC_LIMIT = 5

const COUNTABLE_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function orderNetCents(order: {
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affiliateFeeCents: number
  affiliateMarginCents: number
}): number {
  return netAffiliateTransferCents({
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: order.affiliateMarginCents,
  })
}

function buildDailySeries(
  orders: Array<{ createdAt: Date; netCents: number }>,
  days: number,
  now: Date
): AffiliateDashboardAnalytics["dailyRevenue"] {
  const byDay = new Map<string, { revenueCents: number; orders: number }>()

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { revenueCents: 0, orders: 0 }
    row.revenueCents += order.netCents
    row.orders += 1
    byDay.set(key, row)
  }

  const series: AffiliateDashboardAnalytics["dailyRevenue"] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { revenueCents: 0, orders: 0 }
    series.push({
      day: key,
      revenueCents: row.revenueCents,
      orders: row.orders,
    })
  }
  return series
}

export async function loadAffiliateDashboardAnalytics(
  affiliateId: string,
  now = new Date()
): Promise<AffiliateDashboardAnalytics> {
  const since = new Date(startOfUtcDay(now).getTime() - (AFFILIATE_ANALYTICS_WINDOW_DAYS - 1) * 86_400_000)
  const payoutHorizon = addDays(now, 7)

  const [windowOrders, productGroups, pendingPayoutOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        affiliateId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
      select: {
        createdAt: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        affiliateFeeCents: true,
        affiliateMarginCents: true,
      },
    }),
    prisma.order.groupBy({
      by: ["affiliateProductId"],
      where: {
        affiliateId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
      _sum: {
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: AFFILIATE_ANALYTICS_TOP_EPC_LIMIT * 3,
    }),
    prisma.order.findMany({
      where: {
        affiliateId,
        affiliatePayoutAt: null,
        status: { in: [...COUNTABLE_STATUSES] },
        payoutEligibleAt: { not: null, lte: payoutHorizon },
      },
      select: {
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        affiliateFeeCents: true,
        affiliateMarginCents: true,
      },
    }),
  ])

  const productIds = productGroups.map((group) => group.affiliateProductId)
  const listings =
    productIds.length > 0
      ? await prisma.affiliateProduct.findMany({
          where: { affiliateId, id: { in: productIds } },
          select: {
            id: true,
            clicks: true,
            product: { select: { name: true } },
            customTitle: true,
          },
        })
      : []

  const ordersWithNet = windowOrders.map((order) => ({
    createdAt: order.createdAt,
    netCents: orderNetCents(order),
  }))

  const dailyRevenue = buildDailySeries(ordersWithNet, AFFILIATE_ANALYTICS_WINDOW_DAYS, now)
  const totalRevenue30dCents = ordersWithNet.reduce((sum, row) => sum + row.netCents, 0)

  const listingById = new Map(
    listings.map((listing) => [
      listing.id,
      {
        clicks: listing.clicks,
        productName: listing.customTitle?.trim() || listing.product.name,
      },
    ])
  )

  const topProductsEpc = productGroups
    .map((group) => {
      const listing = listingById.get(group.affiliateProductId)
      const earningsCents =
        (group._sum.affiliatePayoutCents ?? 0) + (group._sum.affiliateMarginRetainedCents ?? 0)
      const clicks = Math.max(1, listing?.clicks ?? 0)
      const epcCents = Math.round(earningsCents / clicks)
      return {
        affiliateProductId: group.affiliateProductId,
        productName: listing?.productName ?? "Produit",
        epcCents,
        clicks: listing?.clicks ?? 0,
        orders: group._count.id,
        earningsCents,
      }
    })
    .sort((a, b) => b.epcCents - a.epcCents)
    .slice(0, AFFILIATE_ANALYTICS_TOP_EPC_LIMIT)

  const estimatedPayoutJ7Cents = pendingPayoutOrders.reduce(
    (sum, order) => sum + orderNetCents(order),
    0
  )

  console.log("[affiliate-analytics]", {
    affiliateId,
    totalRevenue30dCents,
    estimatedPayoutJ7Cents,
    topEpc: topProductsEpc.length,
    result: "ok",
  })

  return {
    dailyRevenue,
    topProductsEpc,
    estimatedPayoutJ7Cents,
    totalRevenue30dCents,
  }
}
