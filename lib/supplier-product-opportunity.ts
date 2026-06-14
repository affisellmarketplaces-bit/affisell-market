import {
  estimateExtraSalesFromOpportunity,
  OPPORTUNITY_COMMISSION_BOOST_PP,
  suggestCommissionPct,
  type ProductCommissionOpportunity,
} from "@/lib/supplier-product-opportunity-shared"

export {
  estimateExtraSalesFromOpportunity,
  OPPORTUNITY_COMMISSION_BOOST_PP,
  suggestCommissionPct,
  type ProductCommissionOpportunity,
} from "@/lib/supplier-product-opportunity-shared"

import {
  computeDemandPulseScore,
  computeNetworkMomentumPct,
  computeShowcaseGapPct,
  demandPulseTier,
} from "@/lib/supplier-opportunity-pulse-shared"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

const OPPORTUNITY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

export async function loadTopProductCommissionOpportunity(
  supplierId: string
): Promise<ProductCommissionOpportunity | null> {
  const since = new Date(Date.now() - OPPORTUNITY_LOOKBACK_MS)
  const products = await prisma.product.findMany({
    where: { supplierId, active: true, isDraft: false },
    select: { id: true, name: true, commissionRate: true, listingKind: true, images: true },
  })
  if (products.length === 0) return null

  const productIds = products.map((p) => p.id)
  const metaById = new Map(products.map((p) => [p.id, p]))

  const views = await prisma.affisellTrackEvent.findMany({
    where: {
      eventType: "view",
      productId: { in: productIds },
      userId: { not: null },
      createdAt: { gte: since },
    },
    select: { userId: true, productId: true, createdAt: true },
  })
  if (views.length === 0) return null

  const viewerIds = [...new Set(views.map((v) => v.userId!).filter(Boolean))]
  const affiliates = await prisma.user.findMany({
    where: { id: { in: viewerIds }, role: "AFFILIATE" },
    select: { id: true },
  })
  if (affiliates.length === 0) return null

  const affiliateIds = new Set(affiliates.map((a) => a.id))

  const existingListings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      affiliateId: { in: [...affiliateIds] },
    },
    select: { affiliateId: true, productId: true },
  })
  const listed = new Set(existingListings.map((r) => `${r.affiliateId}:${r.productId}`))

  const byProduct = new Map<string, { affiliates: Set<string>; views: number }>()
  for (const v of views) {
    if (!v.userId || !v.productId || !affiliateIds.has(v.userId)) continue
    if (listed.has(`${v.userId}:${v.productId}`)) continue
    const cur = byProduct.get(v.productId) ?? { affiliates: new Set<string>(), views: 0 }
    cur.affiliates.add(v.userId)
    cur.views += 1
    byProduct.set(v.productId, cur)
  }

  let best: { productId: string; affiliates: Set<string>; views: number; score: number } | null = null
  for (const [productId, agg] of byProduct) {
    const score = agg.views + agg.affiliates.size * 3
    if (!best || score > best.score) {
      best = { productId, affiliates: agg.affiliates, views: agg.views, score }
    }
  }
  if (!best || best.affiliates.size === 0) return null

  const meta = metaById.get(best.productId)
  if (!meta) return null

  const currentCommissionPct = Math.round(Number(meta.commissionRate) || 15)
  const { suggested, boostPp } = suggestCommissionPct(
    currentCommissionPct,
    meta.listingKind,
    OPPORTUNITY_COMMISSION_BOOST_PP
  )
  if (boostPp <= 0) return null

  const affiliateViewerCount = best.affiliates.size
  const demandPulseScore = computeDemandPulseScore(affiliateViewerCount, best.views)

  return {
    productId: best.productId,
    productName: meta.name,
    productImageUrl: primaryProductImage(meta.images as string[] | null) || null,
    affiliateViewerCount,
    totalViews: best.views,
    currentCommissionPct,
    suggestedCommissionPct: suggested,
    commissionBoostPct: boostPp,
    estimatedExtraSales7d: estimateExtraSalesFromOpportunity(affiliateViewerCount),
    listingKind: meta.listingKind,
    demandPulseScore,
    demandPulseTier: demandPulseTier(demandPulseScore),
    networkMomentumPct: computeNetworkMomentumPct(affiliateViewerCount, best.views),
    showcaseGapPct: computeShowcaseGapPct(affiliateViewerCount),
  }
}
