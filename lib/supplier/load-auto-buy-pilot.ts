import { prisma } from "@/lib/prisma"
import {
  computeSkuEconomics,
  summarizePilotPortfolio,
  type PilotPortfolioSummary,
  type SkuEconomics,
} from "@/lib/supplier/auto-buy-profitability"

export type AutoBuyPilotSku = {
  productId: string
  name: string
  image: string | null
  productActive: boolean
  sellingPriceCents: number
  cogsCents: number | null
  aeUrl: string | null
  linkActive: boolean
  autoBuyEnabled: boolean
  realized: { orders: number; revenueCents: number; marginCents: number } | null
  economics: SkuEconomics
}

export type DemandRadarCategory = {
  categoryId: string
  name: string
  orders30d: number
  avgSellingCents: number
  supplierHasListing: boolean
}

export type AutoBuyPilotSnapshot = {
  skus: AutoBuyPilotSku[]
  summary: PilotPortfolioSummary
  radar: DemandRadarCategory[]
  windowDays: number
}

const WINDOW_DAYS = 30

/** Auto-buy Pilot : SKUs liés AE + rentabilité (théorique × réalisée) + radar de demande. */
export async function loadAutoBuyPilotSnapshot(
  supplierId: string
): Promise<AutoBuyPilotSnapshot> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [products, supplierCategoryRows] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId, supplierLink: { isNot: null } },
      select: {
        id: true,
        name: true,
        images: true,
        active: true,
        basePriceCents: true,
        commissionRate: true,
        supplierCommissionRateBps: true,
        supplierLink: {
          select: {
            aePriceCents: true,
            aeShippingCents: true,
            aeUrl: true,
            autoBuyEnabled: true,
            isActive: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({
      where: { supplierId, categoryId: { not: null } },
      select: { categoryId: true },
      distinct: ["categoryId"],
    }),
  ])

  const productIds = products.map((p) => p.id)

  const [realizedRows, demandRows] = await Promise.all([
    productIds.length
      ? prisma.order.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds }, paidAt: { gte: since } },
          _count: { _all: true },
          _sum: {
            sellingPriceCents: true,
            supplierMarginCents: true,
            marginCents: true,
          },
        })
      : Promise.resolve([]),
    prisma.order.groupBy({
      by: ["productId"],
      where: { paidAt: { gte: since } },
      _count: { _all: true },
      _avg: { sellingPriceCents: true },
      orderBy: { _count: { productId: "desc" } },
      take: 120,
    }),
  ])

  const realizedByProduct = new Map(
    realizedRows.map((row) => [
      row.productId,
      {
        orders: row._count._all,
        revenueCents: row._sum.sellingPriceCents ?? 0,
        marginCents: row._sum.supplierMarginCents ?? row._sum.marginCents ?? 0,
      },
    ])
  )

  const skus: AutoBuyPilotSku[] = products.map((p) => {
    const link = p.supplierLink
    const cogsCents =
      link && link.aePriceCents > 0
        ? link.aePriceCents + Math.max(0, link.aeShippingCents)
        : null
    const commissionBps = p.supplierCommissionRateBps ?? p.commissionRate * 100
    const realized = realizedByProduct.get(p.id) ?? null
    return {
      productId: p.id,
      name: p.name,
      image: p.images[0] ?? null,
      productActive: p.active,
      sellingPriceCents: p.basePriceCents,
      cogsCents,
      aeUrl: link?.aeUrl ?? null,
      linkActive: link?.isActive ?? false,
      autoBuyEnabled: Boolean(link?.isActive && link.autoBuyEnabled),
      realized,
      economics: computeSkuEconomics({
        sellingPriceCents: p.basePriceCents,
        cogsCents,
        affiliateCommissionBps: commissionBps,
        realized,
      }),
    }
  })

  const radar = await buildDemandRadar(
    demandRows,
    new Set(
      supplierCategoryRows
        .map((row) => row.categoryId)
        .filter((id): id is string => Boolean(id))
    )
  )

  const summary = summarizePilotPortfolio(skus)
  console.log("[auto-buy-pilot]", {
    supplierId,
    skus: summary.totalSkus,
    autoBuyOn: summary.autoBuyOnCount,
    lossCount: summary.lossCount,
    radarCategories: radar.length,
  })

  return { skus, summary, radar, windowDays: WINDOW_DAYS }
}

async function buildDemandRadar(
  demandRows: ReadonlyArray<{
    productId: string
    _count: { _all: number }
    _avg: { sellingPriceCents: number | null }
  }>,
  supplierCategoryIds: ReadonlySet<string>
): Promise<DemandRadarCategory[]> {
  const ids = demandRows.map((row) => row.productId).filter(Boolean)
  if (ids.length === 0) return []

  const demandProducts = await prisma.product.findMany({
    where: { id: { in: ids }, categoryId: { not: null } },
    select: { id: true, categoryId: true, category: { select: { name: true } } },
  })
  const productCategory = new Map(
    demandProducts.map((p) => [p.id, { id: p.categoryId as string, name: p.category?.name ?? "" }])
  )

  const byCategory = new Map<
    string,
    { name: string; orders: number; revenueWeighted: number }
  >()
  for (const row of demandRows) {
    const cat = productCategory.get(row.productId)
    if (!cat?.id || !cat.name) continue
    const entry = byCategory.get(cat.id) ?? { name: cat.name, orders: 0, revenueWeighted: 0 }
    entry.orders += row._count._all
    entry.revenueWeighted += (row._avg.sellingPriceCents ?? 0) * row._count._all
    byCategory.set(cat.id, entry)
  }

  return [...byCategory.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      name: v.name,
      orders30d: v.orders,
      avgSellingCents: v.orders > 0 ? Math.round(v.revenueWeighted / v.orders) : 0,
      supplierHasListing: supplierCategoryIds.has(categoryId),
    }))
    .sort((a, b) => b.orders30d - a.orders30d)
    .slice(0, 8)
}
