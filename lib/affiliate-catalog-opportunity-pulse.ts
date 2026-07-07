import { estimateTotalPartnerGainCents } from "@/lib/affiliate-catalog-margin-display"
import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { affiliateDiscoverCardSelect } from "@/lib/affiliate-dashboard-data"
import {
  AFFILIATE_CREATORS_WATCHING_MIN,
} from "@/lib/affiliate-product-opportunity-pulse-shared"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const VIEW_SCAN_LIMIT = 4_000

export type AffiliateOpportunityPulseCard = {
  productId: string
  name: string
  imageUrl: string | null
  basePriceCents: number
  commissionRate: number
  marginCents: number
  affiliateCreatorsWatching: number
  listingId: string | null
  isInStore: boolean
  supplierLabel: string
}

export type AffiliateViewerAggregate = {
  productId: string
  affiliateViewerCount: number
}

/** Rank product ids by distinct affiliate viewers (7d), highest first. */
export function rankAffiliateViewerAggregates(
  rows: AffiliateViewerAggregate[],
  minViewers = AFFILIATE_CREATORS_WATCHING_MIN
): AffiliateViewerAggregate[] {
  return [...rows]
    .filter((row) => row.affiliateViewerCount >= minViewers)
    .sort((a, b) => b.affiliateViewerCount - a.affiliateViewerCount || a.productId.localeCompare(b.productId))
}

async function loadListedProductIdsForAffiliate(affiliateId: string): Promise<Set<string>> {
  const rows = await prisma.affiliateProduct.findMany({
    where: { affiliateId },
    select: { productId: true },
  })
  return new Set(rows.map((row) => row.productId))
}

/**
 * Distinct affiliate viewers per product (7d) — optional productId filter + exclude self.
 */
export async function buildAffiliateCreatorsWatchingMap(args: {
  productIds?: string[]
  excludeAffiliateId?: string
}): Promise<Map<string, number>> {
  const since = new Date(Date.now() - LOOKBACK_MS)
  const productFilter =
    args.productIds && args.productIds.length > 0 ? { in: args.productIds } : undefined

  try {
    const views = await prisma.affisellTrackEvent.findMany({
      where: {
        eventType: "view",
        ...(productFilter ? { productId: productFilter } : {}),
        userId: { not: null },
        createdAt: { gte: since },
      },
      select: { productId: true, userId: true },
      take: VIEW_SCAN_LIMIT,
    })

    const viewerIds = [
      ...new Set(
        views
          .map((row) => row.userId)
          .filter((uid): uid is string => typeof uid === "string" && Boolean(uid.trim()))
      ),
    ]
    if (viewerIds.length === 0) return new Map()

    const affiliates = await prisma.user.findMany({
      where: { id: { in: viewerIds }, role: "AFFILIATE" },
      select: { id: true },
    })
    const affiliateSet = new Set(affiliates.map((row) => row.id))
    const excludeId = args.excludeAffiliateId?.trim()

    const byProduct = new Map<string, Set<string>>()
    for (const row of views) {
      if (!row.productId || !row.userId || !affiliateSet.has(row.userId)) continue
      if (excludeId && row.userId === excludeId) continue
      const viewers = byProduct.get(row.productId) ?? new Set<string>()
      viewers.add(row.userId)
      byProduct.set(row.productId, viewers)
    }

    return new Map(
      [...byProduct.entries()].map(([productId, viewers]) => [productId, viewers.size])
    )
  } catch (error) {
    console.warn("[affiliate-opportunity-pulse]", {
      metric: "watch_map_failed",
      error: error instanceof Error ? error.message : String(error),
    })
    return new Map()
  }
}

/** Top unlisted SKUs for an affiliate — creators already watching (7d). */
export async function loadAffiliateOpportunityPulsePicks(
  affiliateId: string,
  limit = 3
): Promise<AffiliateOpportunityPulseCard[]> {
  const safeLimit = Math.min(8, Math.max(1, Math.round(limit)))
  const listedIds = await loadListedProductIdsForAffiliate(affiliateId)

  const watchMap = await buildAffiliateCreatorsWatchingMap({ excludeAffiliateId: affiliateId })
  const ranked = rankAffiliateViewerAggregates(
    [...watchMap.entries()]
      .filter(([productId]) => !listedIds.has(productId))
      .map(([productId, affiliateViewerCount]) => ({ productId, affiliateViewerCount }))
  ).slice(0, safeLimit)

  if (ranked.length === 0) {
    console.log("[affiliate-opportunity-pulse]", { affiliateId, picks: 0 })
    return []
  }

  const productIds = ranked.map((row) => row.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      active: true,
      isDraft: false,
      ...buyerMarketplaceProductWhere,
    },
    select: affiliateDiscoverCardSelect(affiliateId),
  })

  const byId = new Map(products.map((row) => [row.id, row]))
  const countById = new Map(ranked.map((row) => [row.productId, row.affiliateViewerCount]))

  const picks: AffiliateOpportunityPulseCard[] = []
  for (const { productId } of ranked) {
    const row = byId.get(productId)
    if (!row) continue

    const supplier = row.supplier as unknown as {
      email: string
      store: { name: string; slug: string } | null
    }
    const listing = row.affiliateProducts?.[0]
    const commissionRate = affiliateCommissionDisplayPct({
      commissionRate: Number(row.commissionRate) || 0,
      variants: row.variants,
      basePriceCents: row.basePriceCents,
    })
    const supplierLabel =
      supplier.store?.name?.trim() || supplier.email.trim() || "Fournisseur"

    picks.push({
      productId: row.id,
      name: row.name,
      imageUrl: primaryProductImage(row.images ?? []) || null,
      basePriceCents: row.basePriceCents,
      commissionRate: Math.round(commissionRate),
      marginCents: estimateTotalPartnerGainCents(row.basePriceCents, commissionRate),
      affiliateCreatorsWatching: countById.get(productId) ?? 0,
      listingId: listing?.id ?? null,
      isInStore: Boolean(listing),
      supplierLabel,
    })
  }

  console.log("[affiliate-opportunity-pulse]", {
    affiliateId,
    picks: picks.length,
    topProductId: picks[0]?.productId ?? null,
  })

  return picks
}

export async function enrichCatalogProductsWithOpportunityPulse<T extends { id: string }>(
  products: T[],
  affiliateId: string
): Promise<Array<T & { affiliateCreatorsWatching: number }>> {
  const unlistedIds = products
    .filter((product) => {
      const row = product as T & { affiliateProducts?: { isListed: boolean }[] }
      const listings = row.affiliateProducts ?? []
      return !listings.some((listing) => listing.isListed)
    })
    .map((product) => product.id)

  const watchMap = await buildAffiliateCreatorsWatchingMap({
    productIds: unlistedIds,
    excludeAffiliateId: affiliateId,
  })

  return products.map((product) => ({
    ...product,
    affiliateCreatorsWatching: watchMap.get(product.id) ?? 0,
  }))
}
