import "server-only"

import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import {
  detectCatalogOpportunities,
  rootOfCategory,
  type CatalogOpportunity,
  type CategoryStats,
} from "@/lib/strategic-intelligence/catalog-opportunities"
import { priceGapRequests, unansweredRequests, type PriceGapCategory, type UnmetCategory } from "@/lib/strategic-intelligence/unmet-demand"

const DAY = 86_400_000
const MAX_PRODUCTS = 20_000
const MAX_ORDERS = 50_000

export type CatalogOpportunityReport = {
  generatedAt: string
  window: { days: 30 }
  opportunities: CatalogOpportunity[]
  /** Product requests without quote / with quotes above target (the cockpit's own rules, reported beside). */
  unansweredRequests: UnmetCategory[]
  priceGaps: PriceGapCategory[]
  categoriesJudged: number
  /** A capped read is never ranked: findings are withheld and this says so. */
  truncated: boolean
}

/**
 * ADMIN, READ-ONLY. Aggregates per taxonomy root — no identifier leaves this function. A capped read (products or
 * orders) returns no ranking (`truncated`), never a partial one presented as complete.
 */
export async function loadCatalogOpportunities(now = new Date()): Promise<CatalogOpportunityReport> {
  const [stats, requests] = await Promise.all([
    loadCategoryStats(now),
    prisma.productRequest.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 90 * DAY) } },
      select: {
        resellerId: true,
        title: true,
        category: true,
        quotesCount: true,
        targetPrice: true,
        createdAt: true,
        status: true,
        quotes: { select: { price: true } },
      },
      take: 5_000,
    }),
  ])
  const reqRows = requests.map((r) => ({
    resellerId: r.resellerId,
    title: r.title,
    category: r.category,
    quotesCount: r.quotesCount,
    targetPriceEur: r.targetPrice ?? null,
    createdAt: r.createdAt,
    status: r.status,
    quotePricesEur: r.quotes.map((q) => q.price).filter((p) => Number.isFinite(p) && p > 0),
  }))
  const base = {
    generatedAt: now.toISOString(),
    window: { days: 30 as const },
    unansweredRequests: unansweredRequests(reqRows, now),
    priceGaps: priceGapRequests(reqRows),
  }
  if (stats.truncated) return { ...base, opportunities: [], categoriesJudged: 0, truncated: true }
  return { ...base, opportunities: detectCatalogOpportunities(stats.rows), categoriesJudged: stats.rows.length, truncated: false }
}

/**
 * Supply state of ONE taxonomy root, now — what the decision journal measures for an opportunity decision (sellable
 * products, suppliers with a sellable product, sellable products listed by ≥ 1 reseller). A capped read throws (the
 * journal then records no measurement rather than a partial one).
 */
export async function measureCategorySupply(rootId: string, now = new Date()): Promise<CategoryStats | null> {
  const stats = await loadCategoryStats(now)
  if (stats.truncated) throw new Error("journal_truncated_read")
  return stats.rows.find((r) => r.rootId === rootId) ?? null
}

/** Per-root demand / supply aggregates. READ-ONLY, bounded; `truncated` = a cap was reached. */
export async function loadCategoryStats(now = new Date()): Promise<{ rows: CategoryStats[]; truncated: boolean }> {
  const since = new Date(now.getTime() - 30 * DAY)
  const [cats, products, orders, listings] = await Promise.all([
    prisma.category.findMany({ select: { id: true, parentId: true, name: true }, take: 50_000 }),
    prisma.product.findMany({
      where: { isDraft: false },
      select: {
        id: true,
        categoryId: true,
        supplierId: true,
        active: true,
        isDraft: true,
        tags: true,
        stock: true,
        hasVariants: true,
        variants: true,
        listingKind: true,
        commissionRate: true,
        offerMode: true,
      },
      take: MAX_PRODUCTS + 1,
    }),
    prisma.order.findMany({
      where: { paidAt: { gte: since } },
      select: { productId: true, affiliateId: true },
      take: MAX_ORDERS + 1,
    }),
    prisma.affiliateProduct.groupBy({ by: ["productId"], where: { isListed: true }, _count: { _all: true } }),
  ])
  const truncated = products.length > MAX_PRODUCTS || orders.length > MAX_ORDERS || cats.length >= 50_000
  if (truncated) return { rows: [], truncated: true }

  const parentOf = new Map(cats.map((c) => [c.id, c.parentId]))
  const nameOf = new Map(cats.map((c) => [c.id, c.name]))
  const listedBy = new Map(listings.map((l) => [l.productId, l._count._all]))
  const productRoot = new Map<string, string>()
  const sellable = new Set<string>()
  const stats = new Map<string, CategoryStats & { suppliers: Set<string>; resellers: Set<string> }>()
  const statOf = (root: string) => {
    let s = stats.get(root)
    if (!s) {
      s = {
        rootId: root,
        label: nameOf.get(root) ?? "Catégorie",
        orders30d: 0,
        ordersOnUnsellable30d: 0,
        sellingResellers: 0,
        activeProducts: 0,
        sellableProducts: 0,
        sellableSuppliers: 0,
        sellableNotListed: 0,
        suppliers: new Set(),
        resellers: new Set(),
      }
      stats.set(root, s)
    }
    return s
  }
  for (const p of products) {
    const root = rootOfCategory(p.categoryId, parentOf)
    if (!root) continue
    productRoot.set(p.id, root)
    const s = statOf(root)
    if (p.active) s.activeProducts++
    if (listingProblem({ ...p, commissionRate: Number(p.commissionRate) || 0 }) === null) {
      sellable.add(p.id)
      s.sellableProducts++
      s.suppliers.add(p.supplierId)
      if (!listedBy.get(p.id)) s.sellableNotListed++
    }
  }
  for (const o of orders) {
    if (!o.productId) continue
    const root = productRoot.get(o.productId)
    if (!root) continue
    const s = statOf(root)
    s.orders30d++
    if (!sellable.has(o.productId)) s.ordersOnUnsellable30d++
    if (o.affiliateId) s.resellers.add(o.affiliateId)
  }
  const rows: CategoryStats[] = [...stats.values()].map(({ suppliers, resellers, ...s }) => ({
    ...s,
    sellableSuppliers: suppliers.size,
    sellingResellers: resellers.size,
  }))
  return { rows, truncated: false }
}
