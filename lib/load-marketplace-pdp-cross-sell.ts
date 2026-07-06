import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import {
  mergeUniqueListingIds,
  rankCoPurchaseListingIds,
  type PdpCrossSellListingRow,
} from "@/lib/marketplace-pdp-cross-sell-shared"
import { prisma } from "@/lib/prisma"

const CROSS_SELL_SELECT = {
  id: true,
  sellingPriceCents: true,
  conversions: true,
  customTitle: true,
  customImages: true,
  product: {
    select: {
      name: true,
      images: true,
    },
  },
  affiliate: {
    select: {
      store: { select: { slug: true } },
    },
  },
} as const

const COUNTABLE_ORDER_STATUSES = ["paid", "preparing", "shipped"] as const

async function loadCoPurchaseScores(args: {
  productId: string
  excludeListingId: string
  limit: number
}): Promise<Array<{ affiliateProductId: string; affiliateId: string; count: number }>> {
  const buyers = await prisma.order.findMany({
    where: {
      productId: args.productId,
      status: { in: [...COUNTABLE_ORDER_STATUSES] },
      paidAt: { not: null },
      customerEmail: { not: "" },
    },
    select: { customerEmail: true },
    distinct: ["customerEmail"],
    take: 400,
  })

  const emails = [
    ...new Set(
      buyers
        .map((row) => row.customerEmail.trim().toLowerCase())
        .filter((email) => email.length > 0)
    ),
  ]
  if (emails.length === 0) return []

  const grouped = await prisma.order.groupBy({
    by: ["affiliateProductId", "affiliateId"],
    where: {
      customerEmail: { in: emails, mode: "insensitive" },
      productId: { not: args.productId },
      affiliateProductId: { not: args.excludeListingId },
      status: { notIn: ["refunded", "cancelled", "PENDING"] },
      affiliateProduct: buyerListedAffiliateProductWhere,
    },
    _count: { _all: true },
  })

  const byListing = new Map<string, { affiliateProductId: string; affiliateId: string; count: number }>()
  for (const row of grouped) {
    const cur = byListing.get(row.affiliateProductId)
    const count = row._count._all
    if (!cur || count > cur.count) {
      byListing.set(row.affiliateProductId, {
        affiliateProductId: row.affiliateProductId,
        affiliateId: row.affiliateId,
        count,
      })
    }
  }

  return [...byListing.values()].sort((a, b) => b.count - a.count).slice(0, args.limit)
}

async function loadListingsByIds(ids: string[]): Promise<PdpCrossSellListingRow[]> {
  if (ids.length === 0) return []
  const rows = await prisma.affiliateProduct.findMany({
    where: {
      id: { in: ids },
      ...buyerListedAffiliateProductWhere,
    },
    select: CROSS_SELL_SELECT,
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id)).filter((row): row is PdpCrossSellListingRow => Boolean(row))
}

async function loadCategoryListings(args: {
  listingId: string
  storeSlug: string | null
  categories: string[]
  excludeIds: string[]
  limit: number
}): Promise<PdpCrossSellListingRow[]> {
  if (args.limit <= 0) return []

  return prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      id: { notIn: [args.listingId, ...args.excludeIds] },
      ...(args.storeSlug ? { affiliate: { store: { slug: args.storeSlug } } } : {}),
      product: {
        ...buyerMarketplaceProductWhere,
        ...(args.categories.length > 0 ? { categories: { hasSome: args.categories.slice(0, 3) } } : {}),
      },
    },
    select: CROSS_SELL_SELECT,
    orderBy: [{ conversions: "desc" }, { updatedAt: "desc" }],
    take: args.limit,
  })
}

async function loadStoreFallbackListings(args: {
  listingId: string
  storeSlug: string | null
  excludeIds: string[]
  limit: number
}): Promise<PdpCrossSellListingRow[]> {
  if (args.limit <= 0 || !args.storeSlug) return []

  return prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      id: { notIn: [args.listingId, ...args.excludeIds] },
      affiliate: { store: { slug: args.storeSlug } },
    },
    select: CROSS_SELL_SELECT,
    orderBy: [{ conversions: "desc" }, { createdAt: "desc" }],
    take: args.limit,
  })
}

export type PdpCrossSellBundle = {
  boughtTogether: PdpCrossSellListingRow[]
  alsoViewed: PdpCrossSellListingRow[]
}

/** PDP cross-sell — co-purchase first, then same-store category, then store bestsellers. */
export async function loadPdpCrossSellBundle(args: {
  listingId: string
  productId: string
  affiliateId: string
  storeSlug: string | null
  categories: string[]
}): Promise<PdpCrossSellBundle> {
  const coScores = await loadCoPurchaseScores({
    productId: args.productId,
    excludeListingId: args.listingId,
    limit: 8,
  })

  const coPurchaseIds = rankCoPurchaseListingIds(coScores, {
    currentAffiliateId: args.affiliateId,
    limit: 4,
  })

  const coPurchaseRows = await loadListingsByIds(coPurchaseIds)
  const boughtTogetherIds = mergeUniqueListingIds(coPurchaseIds)

  let boughtTogether = coPurchaseRows
  if (boughtTogether.length < 4) {
    const categoryRows = await loadCategoryListings({
      listingId: args.listingId,
      storeSlug: args.storeSlug,
      categories: args.categories,
      excludeIds: boughtTogetherIds,
      limit: 4 - boughtTogether.length,
    })
    boughtTogether = [...boughtTogether, ...categoryRows]
  }

  const boughtIds = boughtTogether.map((row) => row.id)
  let alsoViewed = await loadCategoryListings({
    listingId: args.listingId,
    storeSlug: args.storeSlug,
    categories: args.categories,
    excludeIds: boughtIds,
    limit: 4,
  })

  if (alsoViewed.length < 4) {
    const fallbackRows = await loadStoreFallbackListings({
      listingId: args.listingId,
      storeSlug: args.storeSlug,
      excludeIds: [...boughtIds, ...alsoViewed.map((row) => row.id)],
      limit: 4 - alsoViewed.length,
    })
    alsoViewed = [...alsoViewed, ...fallbackRows]
  }

  console.log("[pdp-cross-sell]", {
    listingId: args.listingId,
    coPurchase: coPurchaseIds.length,
    boughtTogether: boughtTogether.length,
    alsoViewed: alsoViewed.length,
  })

  return {
    boughtTogether: boughtTogether.slice(0, 4),
    alsoViewed: alsoViewed.slice(0, 4),
  }
}
