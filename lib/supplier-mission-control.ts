import { primaryProductImage } from "@/lib/product-images"
import { TERMINAL_RETURN_STATUSES } from "@/lib/order-return-types"
import { loadOrdersToShipSla } from "@/lib/supplier-ship-sla"
import { prisma } from "@/lib/prisma"

const MARKETPLACE_COUNTABLE = ["paid", "preparing", "shipped", "refunded"] as const
const LOW_STOCK_THRESHOLD = 5
const MS_7D = 7 * 24 * 60 * 60 * 1000

export type MetricDelta = {
  value: number
  previous: number
  pctChange: number | null
}

export type SupplierUrgentSnapshot = {
  ordersToShip: number
  /** Ms until soonest ship SLA breach; null when no pending orders. */
  ordersToShipSlaMs: number | null
  ordersToShipPenaltyCents: number
  returnsInProgress: number
  lowStockCount: number
  /** Rough daily revenue at risk (cents). */
  lowStockDailyLossCents: number
}

export type SupplierMetrics7d = {
  gmvCents: MetricDelta
  orderCount: MetricDelta
  supplierNetCents: MetricDelta
  commissionCents: MetricDelta
  topSku: {
    productId: string
    name: string
    units: number
    imageUrl: string | null
  } | null
}

export type AffiliateOpportunity = {
  affiliateId: string
  affiliateName: string
  productId: string
  productName: string
  viewCount: number
}

export type DormantSku = {
  id: string
  name: string
  imageUrl: string | null
}

export type SupplierGrowthSnapshot = {
  opportunities: AffiliateOpportunity[]
  adoptionRatePct: number
  skusWithSales: number
  totalSkus: number
  dormantSkus: DormantSku[]
}

export type SupplierMissionControlData = {
  storeName: string
  storeSlug: string | null
  productCount: number
  urgent: SupplierUrgentSnapshot
  metrics7d: SupplierMetrics7d
  growth: SupplierGrowthSnapshot
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function metricDelta(current: number, previous: number): MetricDelta {
  return {
    value: current,
    previous,
    pctChange: pctChange(current, previous),
  }
}

function windowBounds(now: Date): {
  currentFrom: Date
  currentTo: Date
  previousFrom: Date
  previousTo: Date
} {
  const currentTo = now
  const currentFrom = new Date(now.getTime() - MS_7D)
  const previousTo = currentFrom
  const previousFrom = new Date(now.getTime() - MS_7D * 2)
  return { currentFrom, currentTo, previousFrom, previousTo }
}

type OrderAggRow = {
  quantity: number
  sellingPriceCents: number
  basePriceCents: number
  affiliatePayoutCents: number
  affisellFeeCents: number
}

function aggregateOrders(rows: OrderAggRow[]) {
  let gmvCents = 0
  let supplierNetCents = 0
  let commissionCents = 0
  let orderCount = 0

  for (const o of rows) {
    orderCount += 1
    gmvCents += o.sellingPriceCents
    commissionCents += o.affiliatePayoutCents
    supplierNetCents +=
      o.sellingPriceCents - o.basePriceCents - o.affiliatePayoutCents - o.affisellFeeCents
  }

  return { gmvCents, orderCount, supplierNetCents, commissionCents }
}

async function fetchMarketplaceOrders(
  supplierId: string,
  from: Date,
  to: Date
): Promise<OrderAggRow[]> {
  return prisma.order.findMany({
    where: {
      supplierId,
      status: { in: [...MARKETPLACE_COUNTABLE] },
      createdAt: { gte: from, lt: to },
    },
    select: {
      quantity: true,
      sellingPriceCents: true,
      basePriceCents: true,
      affiliatePayoutCents: true,
      affisellFeeCents: true,
    },
  })
}

async function countLowStock(supplierId: string): Promise<number> {
  const [simpleLow, variantLow] = await Promise.all([
    prisma.product.count({
      where: {
        supplierId,
        active: true,
        isDraft: false,
        hasVariants: false,
        stock: { lte: LOW_STOCK_THRESHOLD },
      },
    }),
    prisma.productVariant.count({
      where: {
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { supplierId, active: true, isDraft: false, hasVariants: true },
      },
    }),
  ])
  return simpleLow + variantLow
}

async function topSkuLast7d(
  supplierId: string,
  from: Date,
  to: Date
): Promise<SupplierMetrics7d["topSku"]> {
  const grouped = await prisma.order.groupBy({
    by: ["productId"],
    where: {
      supplierId,
      status: { in: [...MARKETPLACE_COUNTABLE] },
      createdAt: { gte: from, lt: to },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 1,
  })

  const top = grouped[0]
  if (!top?.productId) return null

  const product = await prisma.product.findUnique({
    where: { id: top.productId },
    select: { id: true, name: true, images: true },
  })
  if (!product) return null

  return {
    productId: product.id,
    name: product.name,
    units: top._sum.quantity ?? 0,
    imageUrl: primaryProductImage(product.images) || null,
  }
}

async function loadAffiliateOpportunities(supplierId: string): Promise<AffiliateOpportunity[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const products = await prisma.product.findMany({
    where: { supplierId, active: true, isDraft: false },
    select: { id: true, name: true },
  })
  if (products.length === 0) return []

  const productIds = products.map((p) => p.id)
  const nameById = new Map(products.map((p) => [p.id, p.name]))

  const views = await prisma.affisellTrackEvent.findMany({
    where: {
      eventType: "view",
      productId: { in: productIds },
      userId: { not: null },
      createdAt: { gte: since },
    },
    select: { userId: true, productId: true },
  })

  if (views.length === 0) return []

  const viewerIds = [...new Set(views.map((v) => v.userId!).filter(Boolean))]
  const affiliates = await prisma.user.findMany({
    where: { id: { in: viewerIds }, role: "AFFILIATE" },
    select: { id: true, name: true, email: true },
  })
  if (affiliates.length === 0) return []

  const affiliateIds = new Set(affiliates.map((a) => a.id))
  const affiliateById = new Map(
    affiliates.map((a) => [a.id, a.name?.trim() || a.email.split("@")[0] || "Affilié"])
  )

  const existingListings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      affiliateId: { in: [...affiliateIds] },
    },
    select: { affiliateId: true, productId: true },
  })
  const listed = new Set(existingListings.map((r) => `${r.affiliateId}:${r.productId}`))

  const counts = new Map<string, { affiliateId: string; productId: string; views: number }>()
  for (const v of views) {
    if (!v.userId || !v.productId || !affiliateIds.has(v.userId)) continue
    if (listed.has(`${v.userId}:${v.productId}`)) continue
    const key = `${v.userId}:${v.productId}`
    const cur = counts.get(key) ?? { affiliateId: v.userId, productId: v.productId, views: 0 }
    cur.views += 1
    counts.set(key, cur)
  }

  return [...counts.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
    .map((row) => ({
      affiliateId: row.affiliateId,
      affiliateName: affiliateById.get(row.affiliateId) ?? "Affilié",
      productId: row.productId,
      productName: nameById.get(row.productId) ?? "Produit",
      viewCount: row.views,
    }))
}

async function loadDormantSkus(supplierId: string): Promise<DormantSku[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const sold = await prisma.order.groupBy({
    by: ["productId"],
    where: {
      supplierId,
      status: { in: [...MARKETPLACE_COUNTABLE] },
      createdAt: { gte: since },
    },
  })
  const soldIds = sold.map((s) => s.productId)

  const dormant = await prisma.product.findMany({
    where: {
      supplierId,
      active: true,
      isDraft: false,
      ...(soldIds.length > 0 ? { id: { notIn: soldIds } } : {}),
    },
    select: { id: true, name: true, images: true },
    orderBy: { createdAt: "asc" },
    take: 8,
  })

  return dormant.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: primaryProductImage(p.images) || null,
  }))
}

export async function loadSupplierMissionControl(
  supplierUserId: string
): Promise<SupplierMissionControlData> {
  const now = new Date()
  const { currentFrom, currentTo, previousFrom, previousTo } = windowBounds(now)

  const storePromise = prisma.store.findUnique({
    where: { userId: supplierUserId },
    select: { name: true, slug: true },
  })

  const [
    store,
    productCount,
    ordersToShipSla,
    returnsInProgress,
    lowStockCount,
    currentOrders,
    previousOrders,
    topSku,
    opportunities,
    totalSkus,
    skusWithSales,
    dormantSkus,
  ] = await Promise.all([
    storePromise,
    prisma.product.count({
      where: { supplierId: supplierUserId, active: true, isDraft: false },
    }),
    loadOrdersToShipSla(supplierUserId),
    prisma.orderReturn.count({
      where: {
        order: { supplierId: supplierUserId },
        status: { notIn: [...TERMINAL_RETURN_STATUSES] },
      },
    }),
    countLowStock(supplierUserId),
    fetchMarketplaceOrders(supplierUserId, currentFrom, currentTo),
    fetchMarketplaceOrders(supplierUserId, previousFrom, previousTo),
    topSkuLast7d(supplierUserId, currentFrom, currentTo),
    loadAffiliateOpportunities(supplierUserId),
    prisma.product.count({
      where: { supplierId: supplierUserId, active: true, isDraft: false },
    }),
    prisma.order
      .groupBy({
        by: ["productId"],
        where: {
          supplierId: supplierUserId,
          status: { in: [...MARKETPLACE_COUNTABLE] },
          createdAt: { gte: currentFrom, lt: currentTo },
        },
      })
      .then((rows) => rows.length),
    loadDormantSkus(supplierUserId),
  ])

  const current = aggregateOrders(currentOrders)
  const previous = aggregateOrders(previousOrders)

  const lowStockDailyLossCents = lowStockCount * 600 * 100

  const adoptionRatePct =
    totalSkus > 0 ? Math.round((skusWithSales / totalSkus) * 1000) / 10 : 0

  return {
    storeName: store?.name?.trim() || "votre boutique",
    storeSlug: store?.slug ?? null,
    productCount,
    urgent: {
      ordersToShip: ordersToShipSla.count,
      ordersToShipSlaMs: ordersToShipSla.msUntilBreach,
      ordersToShipPenaltyCents: ordersToShipSla.penaltyCents,
      returnsInProgress,
      lowStockCount,
      lowStockDailyLossCents,
    },
    metrics7d: {
      gmvCents: metricDelta(current.gmvCents, previous.gmvCents),
      orderCount: metricDelta(current.orderCount, previous.orderCount),
      supplierNetCents: metricDelta(current.supplierNetCents, previous.supplierNetCents),
      commissionCents: metricDelta(current.commissionCents, previous.commissionCents),
      topSku,
    },
    growth: {
      opportunities,
      adoptionRatePct,
      skusWithSales,
      totalSkus,
      dormantSkus,
    },
  }
}
