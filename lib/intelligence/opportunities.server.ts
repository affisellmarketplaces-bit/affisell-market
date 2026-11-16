import "server-only"

import type { OrderPaymentSettlementStatus } from "@prisma/client"

import {
  buildOpportunityBoard,
  OPPORTUNITY_WINDOW_DAYS,
  QUALITY_WINDOW_DAYS,
  type OpportunityBoard,
  type OpportunityInputRow,
} from "@/lib/intelligence/opportunities"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { CLOSED_ORDER_STATUS_VALUES, CLOSED_SETTLEMENT_STATUS_VALUES } from "@/lib/orders/payment-state"
import { summarizePriceHistory } from "@/lib/price-history"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

const DAY_MS = 24 * 60 * 60 * 1000
/** Products shown in "no sales data" besides the ones that sold (most recently updated first). */
const NO_SALES_SAMPLE = 60

/**
 * Loads the real figures behind the opportunity board (lib/intelligence/opportunities.ts): paid orders and units per
 * product (30 / 90 days), refunded / returned / disputed orders (90 days), supplier delivery stats, supplier price trend.
 * Read-only. A missing price-history table (migration not applied) just means "no trend".
 */
export async function loadOpportunityBoard(args: { viewerAffiliateId: string | null; limit?: number; now?: Date }): Promise<
  OpportunityBoard & { generatedAt: string; windows: { salesDays: number; qualityDays: number } }
> {
  const now = args.now ?? new Date()
  const since30 = new Date(now.getTime() - OPPORTUNITY_WINDOW_DAYS * DAY_MS)
  const since90 = new Date(now.getTime() - QUALITY_WINDOW_DAYS * DAY_MS)
  const paid90 = { paidAt: { gte: since90 } }

  const [sold30, sold90, refunded90, disputed90] = await Promise.all([
    prisma.order.groupBy({
      by: ["productId"],
      where: { paidAt: { gte: since30 }, product: buyerMarketplaceProductWhere },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
    prisma.order.groupBy({ by: ["productId"], where: { ...paid90, product: buyerMarketplaceProductWhere }, _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["productId"],
      where: {
        ...paid90,
        product: buyerMarketplaceProductWhere,
        OR: [
          { status: { in: [...CLOSED_ORDER_STATUS_VALUES, ...CLOSED_ORDER_STATUS_VALUES.map((s) => s.toUpperCase())] } },
          {
            paymentSettlementStatus: {
              in: [...CLOSED_SETTLEMENT_STATUS_VALUES, "PARTIALLY_REFUNDED"] as OrderPaymentSettlementStatus[],
            },
          },
          { returns: { some: {} } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["productId"],
      where: { ...paid90, product: buyerMarketplaceProductWhere, status: { in: ["disputed", "DISPUTED"] } },
      _count: { _all: true },
    }),
  ])

  const soldIds = sold30.map((r) => r.productId)
  const extra = await prisma.product.findMany({
    where: { ...buyerMarketplaceProductWhere, id: { notIn: soldIds } },
    orderBy: { updatedAt: "desc" },
    take: NO_SALES_SAMPLE,
    select: { id: true },
  })
  const productIds = [...new Set([...soldIds, ...extra.map((p) => p.id)])]
  if (productIds.length === 0) {
    return {
      ...buildOpportunityBoard([]),
      generatedAt: now.toISOString(),
      windows: { salesDays: OPPORTUNITY_WINDOW_DAYS, qualityDays: QUALITY_WINDOW_DAYS },
    }
  }

  const [products, listed] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, ...buyerMarketplaceProductWhere },
      select: {
        id: true,
        name: true,
        images: true,
        basePriceCents: true,
        commissionRate: true,
        supplierId: true,
        supplier: { select: { name: true, store: { select: { name: true } } } },
      },
    }),
    args.viewerAffiliateId
      ? prisma.affiliateProduct.findMany({
          where: { affiliateId: args.viewerAffiliateId, productId: { in: productIds } },
          select: { productId: true },
        })
      : Promise.resolve([] as Array<{ productId: string }>),
  ])

  const supplierIds = [...new Set(products.map((p) => p.supplierId))]
  const [delivery, history] = await Promise.all([
    prisma.supplierDeliveryStats.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, p90EndToEndDays: true, sampleSize: true },
    }),
    prisma.productPriceHistory
      .findMany({
        where: { productId: { in: productIds }, recordedAt: { gte: since90 } },
        orderBy: { recordedAt: "asc" },
        select: { productId: true, priceCents: true, recordedAt: true },
      })
      .catch(() => [] as Array<{ productId: string; priceCents: number; recordedAt: Date }>),
  ])

  const counts = (rows: Array<{ productId: string; _count: unknown }>) =>
    new Map(rows.map((r) => [r.productId, Number((r._count as { _all?: number } | null)?._all ?? 0)]))
  const units30 = new Map(
    sold30.map((r) => [r.productId, Number((r._sum as { quantity?: number | null } | null)?.quantity ?? 0)])
  )
  const o30 = counts(sold30)
  const o90 = counts(sold90)
  const r90 = counts(refunded90)
  const d90 = counts(disputed90)
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
    return {
      productId: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images) || null,
      supplierLabel: p.supplier?.store?.name?.trim() || p.supplier?.name?.trim() || "Fournisseur",
      basePriceCents: p.basePriceCents,
      commissionPercent: p.commissionRate,
      units30: units30.get(p.id) ?? 0,
      orders30: o30.get(p.id) ?? 0,
      orders90: o90.get(p.id) ?? 0,
      refundedOrReturned90: r90.get(p.id) ?? 0,
      disputed90: d90.get(p.id) ?? 0,
      delivery: d ? { p90EndToEndDays: d.p90EndToEndDays, sampleSize: d.sampleSize } : null,
      priceTrend: points && points.length > 0 ? summarizePriceHistory(points, now).trend : null,
      alreadyListedByViewer: listedSet.has(p.id),
    }
  })

  return {
    ...buildOpportunityBoard(rows, { limit: args.limit }),
    generatedAt: now.toISOString(),
    windows: { salesDays: OPPORTUNITY_WINDOW_DAYS, qualityDays: QUALITY_WINDOW_DAYS },
  }
}
