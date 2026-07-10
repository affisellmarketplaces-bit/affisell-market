import "server-only"

import type { SupplierDashboardAnalytics } from "@/lib/supplier-dashboard-analytics-types"
import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { addDays } from "@/lib/order-payout-policy"
import { supplierPublishedProductsWhere } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"

export const SUPPLIER_ANALYTICS_WINDOW_DAYS = 30
export const SUPPLIER_ANALYTICS_TOP_AFFILIATES = 5
export const SUPPLIER_ANALYTICS_TOP_SKU = 8
export const SUPPLIER_ZERO_SALES_DAYS = 7

const COUNTABLE_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const
const REFUND_STATUSES = ["refunded"] as const

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function estimateStripeFeeCents(sellingPriceCents: number): number {
  return Math.round(Math.max(0, sellingPriceCents) * 0.029 + 25)
}

type SupplierOrderRow = {
  id: string
  createdAt: Date
  productId: string
  affiliateId: string
  status: string
  sellingPriceCents: number
  basePriceCents: number
  supplierPriceCents: number
  supplierPayoutCents: number
  supplierCommissionRateBps: number
  affiliatePayoutCents: number
  supplierFeeCents: number
  usesAffisellAutoBuy: boolean
  aeWholesaleCents: number | null
  payoutEligibleAt: Date | null
  supplierPayoutAt: Date | null
}

function orderSupplierNetCents(order: SupplierOrderRow): number {
  return resolveSupplierPayoutCentsFromOrder(order)
}

function buildDailySeries(
  orders: Array<{ createdAt: Date; netCents: number }>,
  days: number,
  now: Date
): SupplierDashboardAnalytics["dailyRevenue"] {
  const byDay = new Map<string, { revenueCents: number; orders: number }>()

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { revenueCents: 0, orders: 0 }
    row.revenueCents += order.netCents
    row.orders += 1
    byDay.set(key, row)
  }

  const series: SupplierDashboardAnalytics["dailyRevenue"] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { revenueCents: 0, orders: 0 }
    series.push({ day: key, revenueCents: row.revenueCents, orders: row.orders })
  }
  return series
}

async function loadZeroSalesAlert(supplierId: string, now: Date): Promise<boolean> {
  const cutoff = addDays(now, -SUPPLIER_ZERO_SALES_DAYS)
  const staleProducts = await prisma.product.findMany({
    where: {
      ...supplierPublishedProductsWhere(supplierId),
      createdAt: { lte: cutoff },
    },
    select: { id: true },
    take: 50,
  })
  if (staleProducts.length === 0) return false

  const productIds = staleProducts.map((p) => p.id)
  const withSales = await prisma.order.groupBy({
    by: ["productId"],
    where: {
      supplierId,
      productId: { in: productIds },
      status: { in: [...COUNTABLE_STATUSES, ...REFUND_STATUSES] },
    },
  })
  const sold = new Set(withSales.map((r) => r.productId))
  return staleProducts.some((p) => !sold.has(p.id))
}

export async function getSupplierAnalytics(
  supplierId: string,
  now = new Date()
): Promise<SupplierDashboardAnalytics> {
  const since = new Date(
    startOfUtcDay(now).getTime() - (SUPPLIER_ANALYTICS_WINDOW_DAYS - 1) * 86_400_000
  )
  const payoutHorizon = addDays(now, 14)

  const [
    windowOrders,
    refundCount,
    totalOrderCount,
    affiliateGroups,
    productGroups,
    pendingPayoutOrders,
    chargebackAgg,
    publishedProducts,
    zeroSalesAlert,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        supplierId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
      select: {
        id: true,
        createdAt: true,
        productId: true,
        affiliateId: true,
        status: true,
        sellingPriceCents: true,
        basePriceCents: true,
        supplierPriceCents: true,
        supplierPayoutCents: true,
        supplierCommissionRateBps: true,
        affiliatePayoutCents: true,
        supplierFeeCents: true,
        usesAffisellAutoBuy: true,
        aeWholesaleCents: true,
        payoutEligibleAt: true,
        supplierPayoutAt: true,
      },
    }),
    prisma.order.count({
      where: {
        supplierId,
        status: { in: [...REFUND_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
    }),
    prisma.order.count({
      where: {
        supplierId,
        status: { in: [...COUNTABLE_STATUSES, ...REFUND_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
    }),
    prisma.order.groupBy({
      by: ["affiliateId"],
      where: {
        supplierId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: SUPPLIER_ANALYTICS_TOP_AFFILIATES * 2,
    }),
    prisma.order.groupBy({
      by: ["productId"],
      where: {
        supplierId,
        status: { in: [...COUNTABLE_STATUSES] },
        createdAt: { gte: since, lte: now },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: SUPPLIER_ANALYTICS_TOP_SKU * 2,
    }),
    prisma.order.findMany({
      where: {
        supplierId,
        supplierPayoutAt: null,
        status: { in: [...COUNTABLE_STATUSES] },
        payoutEligibleAt: { not: null, lte: payoutHorizon },
      },
      select: {
        sellingPriceCents: true,
        basePriceCents: true,
        supplierPriceCents: true,
        supplierPayoutCents: true,
        supplierCommissionRateBps: true,
        affiliatePayoutCents: true,
        supplierFeeCents: true,
        usesAffisellAutoBuy: true,
        aeWholesaleCents: true,
        payoutEligibleAt: true,
      },
    }),
    prisma.merchantPayoutLedger.aggregate({
      where: {
        userId: supplierId,
        entryType: "CLAWBACK",
        createdAt: { gte: since, lte: now },
      },
      _sum: { amountCents: true },
    }),
    prisma.product.findMany({
      where: supplierPublishedProductsWhere(supplierId),
      select: { id: true, name: true },
    }),
    loadZeroSalesAlert(supplierId, now),
  ])

  const ordersWithNet = windowOrders.map((order) => ({
    createdAt: order.createdAt,
    netCents: orderSupplierNetCents(order),
    order,
  }))

  const dailyRevenue = buildDailySeries(ordersWithNet, SUPPLIER_ANALYTICS_WINDOW_DAYS, now)
  const totalRevenue30dCents = ordersWithNet.reduce((sum, row) => sum + row.netCents, 0)
  const stripeFeesCents = windowOrders.reduce(
    (sum, o) => sum + estimateStripeFeeCents(o.sellingPriceCents),
    0
  )
  const chargebackCents = chargebackAgg._sum.amountCents ?? 0
  const netMarginCents = Math.max(0, totalRevenue30dCents - stripeFeesCents - chargebackCents)
  const returnRatePct =
    totalOrderCount > 0 ? Math.round((refundCount / totalOrderCount) * 1000) / 10 : 0

  const affiliateIds = affiliateGroups.map((g) => g.affiliateId)
  const affiliates =
    affiliateIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: affiliateIds } },
          select: {
            id: true,
            name: true,
            email: true,
            store: { select: { name: true } },
          },
        })
      : []
  const affiliateNameById = new Map(
    affiliates.map((a) => [
      a.id,
      a.store?.name?.trim() || a.name?.trim() || a.email.split("@")[0] || "Affilié",
    ])
  )

  const revenueByAffiliate = new Map<string, { revenueCents: number; orders: number }>()
  for (const row of ordersWithNet) {
    const cur = revenueByAffiliate.get(row.order.affiliateId) ?? { revenueCents: 0, orders: 0 }
    cur.revenueCents += row.netCents
    cur.orders += 1
    revenueByAffiliate.set(row.order.affiliateId, cur)
  }

  const topAffiliates = affiliateGroups
    .map((group) => {
      const stats = revenueByAffiliate.get(group.affiliateId) ?? { revenueCents: 0, orders: 0 }
      return {
        affiliateId: group.affiliateId,
        displayName: affiliateNameById.get(group.affiliateId) ?? "Affilié",
        revenueCents: stats.revenueCents,
        orders: stats.orders,
      }
    })
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, SUPPLIER_ANALYTICS_TOP_AFFILIATES)

  const productIds = publishedProducts.map((p) => p.id)
  const productNameById = new Map(publishedProducts.map((p) => [p.id, p.name]))

  const [trackViews, listingClicks] = await Promise.all([
    productIds.length > 0
      ? prisma.affisellTrackEvent.groupBy({
          by: ["productId"],
          where: {
            productId: { in: productIds },
            eventType: "view",
            createdAt: { gte: since, lte: now },
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
    productIds.length > 0
      ? prisma.affiliateProduct.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds } },
          _sum: { clicks: true, conversions: true },
        })
      : Promise.resolve([]),
  ])

  const viewsByProduct = new Map(
    trackViews.map((r) => [r.productId ?? "", r._count.id])
  )
  const clicksByProduct = new Map(
    listingClicks.map((r) => [r.productId, r._sum.clicks ?? 0])
  )

  const revenueByProduct = new Map<string, { revenueCents: number; orders: number }>()
  for (const row of ordersWithNet) {
    const cur = revenueByProduct.get(row.order.productId) ?? { revenueCents: 0, orders: 0 }
    cur.revenueCents += row.netCents
    cur.orders += 1
    revenueByProduct.set(row.order.productId, cur)
  }

  const skuPerformance = productIds
    .map((productId) => {
      const views = viewsByProduct.get(productId) ?? 0
      const clicks = Math.max(views, clicksByProduct.get(productId) ?? 0)
      const stats = revenueByProduct.get(productId) ?? { revenueCents: 0, orders: 0 }
      const denominator = Math.max(1, clicks)
      const conversionRatePct = Math.round((stats.orders / denominator) * 1000) / 10
      const epcCents = Math.round(stats.revenueCents / denominator)
      return {
        productId,
        productName: productNameById.get(productId) ?? "SKU",
        views,
        clicks,
        conversionRatePct,
        epcCents,
        orders: stats.orders,
        revenueCents: stats.revenueCents,
      }
    })
    .sort((a, b) => b.epcCents - a.epcCents)
    .slice(0, SUPPLIER_ANALYTICS_TOP_SKU)

  const estimatedNextPayoutCents = pendingPayoutOrders.reduce(
    (sum, order) => sum + orderSupplierNetCents(order as SupplierOrderRow),
    0
  )

  let estimatedNextPayoutDate: string | null = null
  const payoutDates = pendingPayoutOrders
    .map((o) => o.payoutEligibleAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())
  if (payoutDates[0]) {
    estimatedNextPayoutDate = payoutDates[0].toISOString().slice(0, 10)
  }

  console.log("[supplier-analytics]", {
    supplierId,
    totalRevenue30dCents,
    netMarginCents,
    zeroSalesAlert,
    result: "ok",
  })

  return {
    dailyRevenue,
    topAffiliates,
    skuPerformance,
    totalRevenue30dCents,
    returnRatePct,
    netMarginCents,
    stripeFeesCents,
    chargebackCents,
    estimatedNextPayoutCents,
    estimatedNextPayoutDate,
    zeroSalesAlert,
  }
}

/** Alias for dashboard loaders. */
export const loadSupplierDashboardAnalytics = getSupplierAnalytics
