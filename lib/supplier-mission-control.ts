import { primaryProductImage } from "@/lib/product-images"
import {
  loadSupplierUrgentSnapshot,
  type SupplierUrgentSnapshot,
} from "@/lib/supplier-urgent-snapshot"
import {
  loadTopProductCommissionOpportunity,
  type ProductCommissionOpportunity,
} from "@/lib/supplier-product-opportunity"
import { loadSupplierWeeklyGoal, type SupplierWeeklyGoalSnapshot } from "@/lib/supplier-weekly-goal"
import { loadSupplierEscrowSummary } from "@/lib/supplier-escrow-summary.server"
import type { SupplierEscrowSummary } from "@/lib/supplier-escrow-shared"

export type { SupplierUrgentSnapshot } from "@/lib/supplier-urgent-snapshot"
export type { ProductCommissionOpportunity } from "@/lib/supplier-product-opportunity"
import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"

const MARKETPLACE_COUNTABLE = ["paid", "preparing", "shipped", "refunded"] as const
const MS_7D = 7 * 24 * 60 * 60 * 1000

export type MetricDelta = {
  value: number
  previous: number
  pctChange: number | null
}

export type SupplierMetrics7d = {
  gmvCents: MetricDelta
  orderCount: MetricDelta
  supplierNetCents: MetricDelta
  commissionCents: MetricDelta
  /** False when the prior 7d window (J-14→J-7) has no sales baseline. */
  hasPriorPeriodData: boolean
  topSku: {
    productId: string
    name: string
    units: number
    imageUrl: string | null
    stock: number
    dailySales: number
    stockoutDays: number | null
    stockUrgent: boolean
  } | null
}

export type DormantSku = {
  id: string
  name: string
  imageUrl: string | null
}

export type SupplierGrowthSnapshot = {
  topOpportunity: ProductCommissionOpportunity | null
  adoptionRatePct: number
  skusWithSales: number
  totalSkus: number
  dormantSkus: DormantSku[]
}

export type SupplierMissionControlData = {
  storeName: string
  storeSlug: string | null
  productCount: number
  draftCount: number
  urgent: SupplierUrgentSnapshot
  metrics7d: SupplierMetrics7d
  growth: SupplierGrowthSnapshot
  weeklyGoal: SupplierWeeklyGoalSnapshot | null
  escrow: SupplierEscrowSummary
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
  supplierPriceCents: number
  supplierPayoutCents: number
  supplierCommissionRateBps: number
  affiliatePayoutCents: number
  supplierFeeCents: number
  usesAffisellAutoBuy: boolean
  aeWholesaleCents: number | null
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
    supplierNetCents += resolveSupplierPayoutCentsFromOrder(o)
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
      supplierPriceCents: true,
      supplierPayoutCents: true,
      supplierCommissionRateBps: true,
      affiliatePayoutCents: true,
      supplierFeeCents: true,
      usesAffisellAutoBuy: true,
      aeWholesaleCents: true,
    },
  })
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
    select: {
      id: true,
      name: true,
      images: true,
      stock: true,
      hasVariants: true,
      productVariants: { select: { stock: true } },
    },
  })
  if (!product) return null

  const units = top._sum.quantity ?? 0
  const stock = product.hasVariants
    ? product.productVariants.reduce((sum, v) => sum + v.stock, 0)
    : product.stock
  const dailySales = units / 7
  const stockoutDays =
    dailySales > 0 ? Math.floor(stock / dailySales) : null
  const stockUrgent = stockoutDays != null && stockoutDays < 3

  return {
    productId: product.id,
    name: product.name,
    units,
    imageUrl: primaryProductImage(product.images) || null,
    stock,
    dailySales,
    stockoutDays,
    stockUrgent,
  }
}

function hasPriorPeriodSalesBaseline(previous: ReturnType<typeof aggregateOrders>): boolean {
  return (
    previous.gmvCents > 0 ||
    previous.orderCount > 0 ||
    previous.supplierNetCents > 0 ||
    previous.commissionCents > 0
  )
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
    select: { name: true, slug: true, createdAt: true },
  })

  const [
    store,
    productCount,
    draftCount,
    urgent,
    currentOrders,
    previousOrders,
    topSku,
    topOpportunity,
    totalSkus,
    skusWithSales,
    dormantSkus,
    escrow,
  ] = await Promise.all([
    storePromise,
    prisma.product.count({
      where: { supplierId: supplierUserId, active: true, isDraft: false },
    }),
    prisma.product.count({
      where: { supplierId: supplierUserId, active: true, isDraft: true },
    }),
    loadSupplierUrgentSnapshot(supplierUserId),
    fetchMarketplaceOrders(supplierUserId, currentFrom, currentTo),
    fetchMarketplaceOrders(supplierUserId, previousFrom, previousTo),
    topSkuLast7d(supplierUserId, currentFrom, currentTo),
    loadTopProductCommissionOpportunity(supplierUserId),
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
    loadSupplierEscrowSummary(supplierUserId),
  ])

  const weeklyGoal = await loadSupplierWeeklyGoal(supplierUserId, store?.createdAt ?? null)

  const current = aggregateOrders(currentOrders)
  const previous = aggregateOrders(previousOrders)

  const adoptionRatePct =
    totalSkus > 0 ? Math.round((skusWithSales / totalSkus) * 1000) / 10 : 0

  return {
    storeName: store?.name?.trim() || "votre boutique",
    storeSlug: store?.slug ?? null,
    productCount,
    draftCount,
    urgent,
    metrics7d: {
      hasPriorPeriodData: hasPriorPeriodSalesBaseline(previous),
      gmvCents: metricDelta(current.gmvCents, previous.gmvCents),
      orderCount: metricDelta(current.orderCount, previous.orderCount),
      supplierNetCents: metricDelta(current.supplierNetCents, previous.supplierNetCents),
      commissionCents: metricDelta(current.commissionCents, previous.commissionCents),
      topSku,
    },
    growth: {
      topOpportunity,
      adoptionRatePct,
      skusWithSales,
      totalSkus,
      dormantSkus,
    },
    weeklyGoal,
    escrow,
  }
}
