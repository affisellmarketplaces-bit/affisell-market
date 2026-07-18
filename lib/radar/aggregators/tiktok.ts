import "server-only"

import { Prisma } from ".prisma/client-mi"

import { getRadarDb } from "@/lib/prisma-radar"
import type { TikTokOrderSkuLine } from "@/lib/tiktok/order-map"

/** Shared Radar aggregator shape (Amazon/Shopify-compatible). */
export type RadarDateRange = {
  shopIds: string[]
  from: Date
  to: Date
}

export type RadarMoneyResult = {
  source: "tiktok_shop"
  shopIds: string[]
  from: Date
  to: Date
  amount: number
  currency: string
  previousAmount: number
  deltaPct: number | null
}

export type RadarCountResult = {
  source: "tiktok_shop"
  shopIds: string[]
  from: Date
  to: Date
  count: number
  previousCount: number
  deltaPct: number | null
}

export type RadarTopProduct = {
  sku: string
  productId?: string
  title?: string
  imageUrl?: string
  qty: number
  revenue: number
}

export type RadarFeesResult = {
  source: "tiktok_shop"
  shopIds: string[]
  from: Date
  to: Date
  platformFee: number
  shippingFee: number
  productFee: number
  total: number
}

export type RadarProfitResult = {
  source: "tiktok_shop"
  shopIds: string[]
  from: Date
  to: Date
  revenue: number
  fees: number
  cogs: number
  profit: number
}

export type RadarDailyPoint = {
  date: string // YYYY-MM-DD
  revenue: number
  orders: number
}

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const n = Number(v.toString())
  return Number.isFinite(n) ? n : 0
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime()
  return {
    from: new Date(from.getTime() - ms),
    to: new Date(from.getTime()),
  }
}

function orderWhere(shopIds: string[], from: Date, to: Date): Prisma.TikTokOrderWhereInput {
  return {
    shopId: { in: shopIds },
    OR: [
      { orderCreatedAt: { gte: from, lt: to } },
      { orderCreatedAt: null, syncedAt: { gte: from, lt: to } },
    ],
    AND: [
      {
        OR: [
          { orderStatus: null },
          { orderStatus: { notIn: ["140", "CANCELLED", "cancelled", "CANCELED", "canceled"] } },
        ],
      },
    ],
  }
}

async function sumAmount(
  shopIds: string[],
  from: Date,
  to: Date
): Promise<{ amount: number; currency: string }> {
  if (shopIds.length === 0) return { amount: 0, currency: "USD" }
  const db = getRadarDb()
  const rows = await db.tikTokOrder.findMany({
    where: orderWhere(shopIds, from, to),
    select: { totalAmount: true, currency: true },
  })
  let amount = 0
  let currency = "USD"
  for (const r of rows) {
    amount += dec(r.totalAmount)
    if (r.currency) currency = r.currency
  }
  return { amount, currency }
}

export async function getTikTokRevenue(input: RadarDateRange): Promise<RadarMoneyResult> {
  const prev = previousRange(input.from, input.to)
  const [cur, prevAmt] = await Promise.all([
    sumAmount(input.shopIds, input.from, input.to),
    sumAmount(input.shopIds, prev.from, prev.to),
  ])
  return {
    source: "tiktok_shop",
    shopIds: input.shopIds,
    from: input.from,
    to: input.to,
    amount: cur.amount,
    currency: cur.currency,
    previousAmount: prevAmt.amount,
    deltaPct: deltaPct(cur.amount, prevAmt.amount),
  }
}

export async function getTikTokOrdersCount(input: RadarDateRange): Promise<RadarCountResult> {
  if (input.shopIds.length === 0) {
    return {
      source: "tiktok_shop",
      shopIds: [],
      from: input.from,
      to: input.to,
      count: 0,
      previousCount: 0,
      deltaPct: 0,
    }
  }
  const db = getRadarDb()
  const prev = previousRange(input.from, input.to)
  const [count, previousCount] = await Promise.all([
    db.tikTokOrder.count({ where: orderWhere(input.shopIds, input.from, input.to) }),
    db.tikTokOrder.count({ where: orderWhere(input.shopIds, prev.from, prev.to) }),
  ])
  return {
    source: "tiktok_shop",
    shopIds: input.shopIds,
    from: input.from,
    to: input.to,
    count,
    previousCount,
    deltaPct: deltaPct(count, previousCount),
  }
}

export async function getTikTokTopProducts(
  input: RadarDateRange,
  limit = 10
): Promise<RadarTopProduct[]> {
  if (input.shopIds.length === 0) return []
  const db = getRadarDb()
  const rows = await db.tikTokOrder.findMany({
    where: orderWhere(input.shopIds, input.from, input.to),
    select: { skuList: true },
  })

  const map = new Map<string, RadarTopProduct>()
  for (const row of rows) {
    const list = Array.isArray(row.skuList) ? (row.skuList as TikTokOrderSkuLine[]) : []
    for (const line of list) {
      const sku = String(line.sku ?? "").trim()
      if (!sku) continue
      const qty = Number(line.qty) || 0
      const unit = Number(line.unitPrice) || 0
      const revenue = qty * unit
      const prev = map.get(sku)
      if (prev) {
        prev.qty += qty
        prev.revenue += revenue
        if (!prev.title && line.title) prev.title = line.title
        if (!prev.imageUrl && line.imageUrl) prev.imageUrl = line.imageUrl
      } else {
        map.set(sku, {
          sku,
          productId: line.productId,
          title: line.title,
          imageUrl: line.imageUrl,
          qty,
          revenue,
        })
      }
    }
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export async function getTikTokFees(input: RadarDateRange): Promise<RadarFeesResult> {
  if (input.shopIds.length === 0) {
    return {
      source: "tiktok_shop",
      shopIds: [],
      from: input.from,
      to: input.to,
      platformFee: 0,
      shippingFee: 0,
      productFee: 0,
      total: 0,
    }
  }
  const db = getRadarDb()
  const rows = await db.tikTokOrder.findMany({
    where: orderWhere(input.shopIds, input.from, input.to),
    select: { platformFee: true, shippingFee: true, productFee: true },
  })
  let platformFee = 0
  let shippingFee = 0
  let productFee = 0
  for (const r of rows) {
    platformFee += dec(r.platformFee)
    shippingFee += dec(r.shippingFee)
    productFee += dec(r.productFee)
  }
  return {
    source: "tiktok_shop",
    shopIds: input.shopIds,
    from: input.from,
    to: input.to,
    platformFee,
    shippingFee,
    productFee,
    total: platformFee + shippingFee,
  }
}

export async function getTikTokProfit(input: RadarDateRange): Promise<RadarProfitResult> {
  const [revenue, fees] = await Promise.all([
    getTikTokRevenue(input),
    getTikTokFees(input),
  ])

  let cogs = 0
  if (input.shopIds.length > 0) {
    const db = getRadarDb()
    const products = await db.standardProduct.findMany({
      where: {
        connectorId: "tiktok_shop",
        shopId: { in: input.shopIds },
        price: { not: null },
      },
      select: { externalId: true, price: true },
      take: 500,
    })
    if (products.length > 0) {
      const priceBySku = new Map(products.map((p) => [p.externalId, dec(p.price)]))
      const top = await getTikTokTopProducts(input, 200)
      for (const p of top) {
        const unitCost = priceBySku.get(p.sku) ?? priceBySku.get(p.productId ?? "")
        if (unitCost != null) cogs += unitCost * p.qty
      }
    }
  }

  const feeTotal = fees.total
  return {
    source: "tiktok_shop",
    shopIds: input.shopIds,
    from: input.from,
    to: input.to,
    revenue: revenue.amount,
    fees: feeTotal,
    cogs,
    profit: revenue.amount - feeTotal - cogs,
  }
}

export async function getTikTokDailyRevenue(input: RadarDateRange): Promise<RadarDailyPoint[]> {
  if (input.shopIds.length === 0) return []
  const db = getRadarDb()
  const rows = await db.tikTokOrder.findMany({
    where: orderWhere(input.shopIds, input.from, input.to),
    select: { orderCreatedAt: true, syncedAt: true, totalAmount: true },
  })

  const byDay = new Map<string, RadarDailyPoint>()
  for (const r of rows) {
    const d = r.orderCreatedAt ?? r.syncedAt
    const key = d.toISOString().slice(0, 10)
    const prev = byDay.get(key) ?? { date: key, revenue: 0, orders: 0 }
    prev.revenue += dec(r.totalAmount)
    prev.orders += 1
    byDay.set(key, prev)
  }

  // Fill empty days for chart continuity
  const out: RadarDailyPoint[] = []
  const cursor = new Date(Date.UTC(input.from.getUTCFullYear(), input.from.getUTCMonth(), input.from.getUTCDate()))
  const end = new Date(Date.UTC(input.to.getUTCFullYear(), input.to.getUTCMonth(), input.to.getUTCDate()))
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10)
    out.push(byDay.get(key) ?? { date: key, revenue: 0, orders: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export type TikTokSalesDashboard = {
  revenue: RadarMoneyResult
  orders: RadarCountResult
  aov: number
  fees: RadarFeesResult
  profit: RadarProfitResult
  daily: RadarDailyPoint[]
  topProducts: RadarTopProduct[]
}

export async function getTikTokSalesDashboard(
  input: RadarDateRange
): Promise<TikTokSalesDashboard> {
  const [revenue, orders, fees, profit, daily, topProducts] = await Promise.all([
    getTikTokRevenue(input),
    getTikTokOrdersCount(input),
    getTikTokFees(input),
    getTikTokProfit(input),
    getTikTokDailyRevenue(input),
    getTikTokTopProducts(input, 10),
  ])
  const aov = orders.count > 0 ? revenue.amount / orders.count : 0
  return { revenue, orders, aov, fees, profit, daily, topProducts }
}
