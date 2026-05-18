import { affiliateCommissionMaxPct, parseListingKind } from "@/lib/supplier-commission"
import { prisma } from "@/lib/prisma"

const OPPORTUNITY_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
/** Default commission bump offered in Mission Control (percentage points). */
export const OPPORTUNITY_COMMISSION_BOOST_PP = 5

export type ProductCommissionOpportunity = {
  productId: string
  productName: string
  affiliateViewerCount: number
  totalViews: number
  currentCommissionPct: number
  suggestedCommissionPct: number
  commissionBoostPct: number
  estimatedExtraSales7d: number
  listingKind: string
}

export function estimateExtraSalesFromOpportunity(
  uniqueAffiliates: number,
  totalViews: number,
  commissionBoostPct: number
): number {
  const viewSignal = totalViews / 7.5
  const affiliateSignal = Math.min(uniqueAffiliates, 8) * 0.08
  const boostSignal = commissionBoostPct >= 5 ? 0.35 : commissionBoostPct / 15
  return Math.max(1, Math.min(12, Math.round(viewSignal + affiliateSignal + boostSignal)))
}

export function suggestCommissionPct(
  currentPct: number,
  listingKind: string,
  boostPp = OPPORTUNITY_COMMISSION_BOOST_PP
): { suggested: number; boostPp: number } {
  const max = affiliateCommissionMaxPct(parseListingKind(listingKind))
  const boost = Math.min(boostPp, Math.max(0, max - currentPct))
  return {
    suggested: Math.min(max, currentPct + boost),
    boostPp: boost,
  }
}

export async function loadTopProductCommissionOpportunity(
  supplierId: string
): Promise<ProductCommissionOpportunity | null> {
  const since = new Date(Date.now() - OPPORTUNITY_LOOKBACK_MS)
  const products = await prisma.product.findMany({
    where: { supplierId, active: true, isDraft: false },
    select: { id: true, name: true, commissionRate: true, listingKind: true },
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
    select: { userId: true, productId: true },
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

  return {
    productId: best.productId,
    productName: meta.name,
    affiliateViewerCount: best.affiliates.size,
    totalViews: best.views,
    currentCommissionPct,
    suggestedCommissionPct: suggested,
    commissionBoostPct: boostPp,
    estimatedExtraSales7d: estimateExtraSalesFromOpportunity(
      best.affiliates.size,
      best.views,
      boostPp
    ),
    listingKind: meta.listingKind,
  }
}
