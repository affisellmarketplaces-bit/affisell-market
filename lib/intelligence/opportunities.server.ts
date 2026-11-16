import "server-only"

import {
  buildOpportunityBoard,
  isProductStockMeaningful,
  OPPORTUNITY_WINDOW_DAYS,
  QUALITY_WINDOW_DAYS,
  type OpportunityBoard,
  type OpportunityInputRow,
} from "@/lib/intelligence/opportunities"
import { aggregatePaidOrders, DAY_MS } from "@/lib/intelligence/order-aggregates"
import { loadBasePriceAt, loadPaidOrderFacts } from "@/lib/intelligence/order-facts.server"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { summarizePriceHistory } from "@/lib/price-history"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

/** Products shown in "no sales data" besides the ones that sold (most recently updated first). */
const NO_SALES_SAMPLE = 60

export type OpportunityBoardResult = OpportunityBoard & {
  generatedAt: string
  windows: { salesDays: number; qualityDays: number }
  /** The order cap was hit: figures are lower bounds. */
  truncated: boolean
}

/**
 * Loads the real figures behind the opportunity board (lib/intelligence/opportunities.ts): paid orders of every reseller
 * over 90 days (units per 30-day period, value charged, value refunded — partial refunds pro rata —, orders ever disputed),
 * supplier delivery stats, the supplier price trend and the price of 30 days ago, and the declared stock. Read-only. A
 * missing price-history table just means "no trend".
 */
export async function loadOpportunityBoard(args: {
  viewerAffiliateId: string | null
  limit?: number
  now?: Date
}): Promise<OpportunityBoardResult> {
  const now = args.now ?? new Date()
  const since90 = new Date(now.getTime() - QUALITY_WINDOW_DAYS * DAY_MS)
  const since30 = new Date(now.getTime() - OPPORTUNITY_WINDOW_DAYS * DAY_MS)
  const windows = { salesDays: OPPORTUNITY_WINDOW_DAYS, qualityDays: QUALITY_WINDOW_DAYS }

  const { facts, truncated } = await loadPaidOrderFacts({ where: { product: buyerMarketplaceProductWhere }, since: since90 })
  const aggregates = aggregatePaidOrders(facts, { now, periodDays: OPPORTUNITY_WINDOW_DAYS, qualityDays: QUALITY_WINDOW_DAYS })

  const soldIds = [...aggregates.values()].filter((a) => a.current.orders > 0).map((a) => a.productId)
  const extra = await prisma.product.findMany({
    where: { ...buyerMarketplaceProductWhere, id: { notIn: soldIds } },
    orderBy: { updatedAt: "desc" },
    take: NO_SALES_SAMPLE,
    select: { id: true },
  })
  const productIds = [...new Set([...soldIds, ...extra.map((p) => p.id)])]
  if (productIds.length === 0) {
    return { ...buildOpportunityBoard([]), generatedAt: now.toISOString(), windows, truncated }
  }

  const [products, listed, price30dAgo] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, ...buyerMarketplaceProductWhere },
      select: {
        id: true,
        name: true,
        images: true,
        basePriceCents: true,
        commissionRate: true,
        supplierId: true,
        stock: true,
        listingKind: true,
        hasVariants: true,
        variants: true,
        supplier: { select: { name: true, store: { select: { name: true } } } },
      },
    }),
    args.viewerAffiliateId
      ? prisma.affiliateProduct.findMany({
          where: { affiliateId: args.viewerAffiliateId, productId: { in: productIds } },
          select: { productId: true },
        })
      : Promise.resolve([] as Array<{ productId: string }>),
    loadBasePriceAt(productIds, since30),
  ])

  const supplierIds = [...new Set(products.map((p) => p.supplierId))]
  const [delivery, history] = await Promise.all([
    prisma.supplierDeliveryStats.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, p90EndToEndDays: true, sampleSize: true },
    }),
    prisma.productPriceHistory
      .findMany({
        where: { productId: { in: productIds }, recordedAt: { gte: since90 }, variantKey: null },
        orderBy: { recordedAt: "asc" },
        select: { productId: true, priceCents: true, recordedAt: true },
      })
      .catch(() => [] as Array<{ productId: string; priceCents: number; recordedAt: Date }>),
  ])

  type DeliveryRow = { supplierId: string; p90EndToEndDays: number | null; sampleSize: number }
  const deliveryBySupplier = new Map((delivery as DeliveryRow[]).map((d) => [d.supplierId, d]))
  const listedSet = new Set(listed.map((l) => l.productId))
  const historyByProduct = new Map<string, Array<{ priceCents: number; recordedAt: Date }>>()
  for (const h of history as Array<{ productId: string; priceCents: number; recordedAt: Date }>) {
    const list = historyByProduct.get(h.productId) ?? []
    list.push({ priceCents: h.priceCents, recordedAt: h.recordedAt })
    historyByProduct.set(h.productId, list)
  }

  const rows: OpportunityInputRow[] = products.map((p) => {
    const d = deliveryBySupplier.get(p.supplierId)
    const points = historyByProduct.get(p.id)
    const a = aggregates.get(p.id)
    return {
      productId: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images) || null,
      supplierLabel: p.supplier?.store?.name?.trim() || p.supplier?.name?.trim() || "Fournisseur",
      basePriceCents: p.basePriceCents,
      commissionPercent: p.commissionRate,
      basePrice30dAgoCents: price30dAgo.get(p.id) ?? null,
      units30: a?.current.units ?? 0,
      orders30: a?.current.orders ?? 0,
      unitsPrev30: a?.previous.units ?? 0,
      ordersPrev30: a?.previous.orders ?? 0,
      orders90: a?.quality.orders ?? 0,
      chargedCents90: a?.quality.chargedCents ?? 0,
      refundedCents90: a?.quality.refundedCents ?? 0,
      disputedOrders90: a?.quality.disputedOrders ?? 0,
      delivery: d ? { p90EndToEndDays: d.p90EndToEndDays, sampleSize: d.sampleSize } : null,
      priceTrend: points && points.length > 0 ? summarizePriceHistory(points, now).trend : null,
      stock: {
        units: p.stock,
        managed: isProductStockMeaningful(p),
      },
      alreadyListedByViewer: listedSet.has(p.id),
    }
  })

  return { ...buildOpportunityBoard(rows, { limit: args.limit }), generatedAt: now.toISOString(), windows, truncated }
}
