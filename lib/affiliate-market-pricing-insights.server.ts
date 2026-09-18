import "server-only"

import { prisma } from "@/lib/prisma"
import {
  computeInsightFromComparables,
  noCategoryInsight,
  type MarketPricingInsight,
} from "@/lib/affiliate-market-pricing-insights-shared"

export type { MarketPricingInsight }

/** Matches the "counted as a real sale" definition used by product social proof. */
const COUNTABLE_ORDER_STATUSES = ["paid", "preparing", "shipped"]
const SALES_WINDOW_DAYS = 30
/** Cap the comparable-listing sample so the query stays bounded on large categories. */
const MAX_COMPARABLE_LISTINGS = 200

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

/**
 * Real market pricing signal for the affiliate pricing panel: comparable listings in the same
 * category (actual `sellingPriceCents`) and their actual paid-order velocity over the last 30
 * days — replaces the previous random-number "AI" placeholder with the platform's own data.
 */
export async function computeMarketPricingInsight(args: {
  categoryId: string | null
  supplierPriceCents: number
  currentPriceCents: number
  excludeAffiliateProductId?: string
}): Promise<MarketPricingInsight> {
  if (!args.categoryId) {
    return noCategoryInsight(args.supplierPriceCents)
  }

  const comparables = await prisma.affiliateProduct.findMany({
    where: {
      isListed: true,
      id: args.excludeAffiliateProductId ? { not: args.excludeAffiliateProductId } : undefined,
      product: { categoryId: args.categoryId, active: true, isDraft: false },
    },
    select: { productId: true, sellingPriceCents: true },
    take: MAX_COMPARABLE_LISTINGS,
    orderBy: { conversions: "desc" },
  })

  if (comparables.length === 0) {
    return noCategoryInsight(args.supplierPriceCents)
  }

  const productIds = [...new Set(comparables.map((c) => c.productId))]
  const since = daysAgo(SALES_WINDOW_DAYS)
  const salesByProduct = await prisma.order.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      paidAt: { gte: since, not: null },
      status: { in: COUNTABLE_ORDER_STATUSES },
    },
    _sum: { quantity: true },
  })
  const monthlySalesByProduct = new Map<string, number>(
    salesByProduct.map((row) => [row.productId, row._sum.quantity ?? 0])
  )

  const listings = comparables.map((c) => ({
    sellingPriceCents: c.sellingPriceCents,
    monthlySales: monthlySalesByProduct.get(c.productId) ?? 0,
  }))

  return computeInsightFromComparables({
    listings,
    supplierPriceCents: args.supplierPriceCents,
    currentPriceCents: args.currentPriceCents,
  })
}
