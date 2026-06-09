import type { Prisma, PrismaClient } from "@prisma/client"

import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import {
  expandMarketplaceSearchTerms,
  rankListingSearchHits,
  type ListingSearchDocument,
  type MarketplaceSearchHit,
} from "@/lib/marketplace-search"
import { taxonomyBridgeTerms } from "@/lib/marketplace-search-taxonomy.server"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

const listedWithStoreWhere: Prisma.AffiliateProductWhereInput = {
  ...buyerListedAffiliateProductWhere,
  affiliate: { store: { isNot: null } },
}

const SEARCH_CANDIDATE_TAKE = 400

/** pg_trgm pre-filter when extension is available; falls back to Prisma contains. */
async function findSearchCandidateListingIds(
  client: PrismaClient,
  rawQuery: string
): Promise<string[] | null> {
  const q = rawQuery.trim()
  if (q.length < 2) return []

  try {
    const rows = await client.$queryRaw<Array<{ id: string }>>`
      SELECT ap.id
      FROM "AffiliateProduct" ap
      INNER JOIN "Product" p ON ap."productId" = p.id
      INNER JOIN "User" u ON ap."affiliateId" = u.id
      LEFT JOIN "Store" s ON s."userId" = u.id
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      WHERE ap."isListed" = true
        AND u.role = 'AFFILIATE'
        AND s.id IS NOT NULL
        AND p.active = true
        AND p."isDraft" = false
        AND (
          p.name % ${q}
          OR COALESCE(ap."customTitle", '') % ${q}
          OR p.description % ${q}
          OR p.name ILIKE ${`%${q}%`}
          OR COALESCE(ap."customTitle", '') ILIKE ${`%${q}%`}
          OR COALESCE(c."fullPath", '') ILIKE ${`%${q}%`}
          OR COALESCE(c.name, '') ILIKE ${`%${q}%`}
        )
      ORDER BY GREATEST(
        similarity(p.name, ${q}),
        similarity(COALESCE(ap."customTitle", ''), ${q})
      ) DESC
      LIMIT ${SEARCH_CANDIDATE_TAKE}
    `
    return rows.map((r) => r.id)
  } catch {
    return null
  }
}

/** Prisma fallback — synonyms + taxonomy bridge + category path (covers pg_trgm zero-hit cases). */
async function findSearchCandidateListingIdsPrisma(
  client: PrismaClient,
  rawQuery: string,
  bridgeTerms: string[] = []
): Promise<string[]> {
  const q = rawQuery.trim()
  if (q.length < 2) return []

  const terms = [...new Set([q, ...expandMarketplaceSearchTerms(q), ...bridgeTerms])]
  const orClauses: Prisma.AffiliateProductWhereInput[] = []

  for (const term of terms) {
    if (term.length < 2) continue
    orClauses.push(
      { customTitle: { contains: term, mode: "insensitive" } },
      { product: { name: { contains: term, mode: "insensitive" } } },
      { product: { description: { contains: term, mode: "insensitive" } } },
      { product: { category: { fullPath: { contains: term, mode: "insensitive" } } } },
      { product: { category: { name: { contains: term, mode: "insensitive" } } } }
    )
  }

  if (orClauses.length === 0) return []

  const rows = await client.affiliateProduct.findMany({
    where: { ...listedWithStoreWhere, OR: orClauses },
    select: { id: true },
    take: SEARCH_CANDIDATE_TAKE,
  })
  return rows.map((r) => r.id)
}

function mergeCandidateListingIds(pgIds: string[] | null, prismaIds: string[]): string[] {
  if (pgIds === null) return [...new Set(prismaIds)]
  return [...new Set([...pgIds, ...prismaIds])]
}

async function loadListingSearchDocuments(
  client: PrismaClient,
  listingIds?: string[]
): Promise<ListingSearchDocument[]> {
  const where: Prisma.AffiliateProductWhereInput = listingIds?.length
    ? { ...listedWithStoreWhere, id: { in: listingIds } }
    : listedWithStoreWhere

  const rows = await client.affiliateProduct.findMany({
    where,
    select: {
      id: true,
      customTitle: true,
      isFeatured: true,
      conversions: true,
      clicks: true,
      product: {
        select: {
          name: true,
          description: true,
          category: { select: { fullPath: true } },
        },
      },
    },
    take: listingIds?.length ? undefined : SEARCH_CANDIDATE_TAKE,
  })

  return rows.map((row) => ({
    listingId: row.id,
    title: listingDisplayTitle(row.customTitle, row.product.name),
    description: row.product.description ?? "",
    categoryPath: row.product.category?.fullPath ?? "",
    isFeatured: row.isFeatured,
    conversions: row.conversions,
    clicks: row.clicks,
  }))
}

/**
 * Ranked listing IDs for buyer search (`q`), optionally scoped to a category subtree.
 */
export async function searchMarketplaceListingHits(
  rawQuery: string,
  options?: {
    scopeCategoryId?: string | null
    limit?: number
    client?: PrismaClient
  }
): Promise<MarketplaceSearchHit[]> {
  const q = rawQuery.trim()
  const limit = options?.limit ?? 120
  const client = options?.client ?? prisma
  if (q.length < 2) return []

  const bridgeTerms = taxonomyBridgeTerms(q)

  const candidateIds = mergeCandidateListingIds(
    await findSearchCandidateListingIds(client, q),
    await findSearchCandidateListingIdsPrisma(client, q, bridgeTerms)
  )

  if (candidateIds.length === 0) return []

  let docs = await loadListingSearchDocuments(client, candidateIds)

  const scopeId = options?.scopeCategoryId?.trim()
  if (scopeId) {
    const { buildCategoryScopeProductFilter } = await import("@/lib/marketplace-category-product-filter")
    const scopeFilter = await buildCategoryScopeProductFilter(client, scopeId)
    const inScope = await client.product.findMany({
      where: scopeFilter,
      select: { id: true },
    })
    const productIds = new Set(inScope.map((p) => p.id))
    const listingRows = await client.affiliateProduct.findMany({
      where: { id: { in: candidateIds }, productId: { in: [...productIds] } },
      select: { id: true, productId: true },
    })
    const allowedListingIds = new Set(listingRows.map((r) => r.id))
    docs = docs.filter((d) => allowedListingIds.has(d.listingId))
  }

  let hits = rankListingSearchHits(docs, q, limit, bridgeTerms)

  // Last resort: SQL matched candidates but scoring rejected all of them
  // (loose trigram matches, language mismatch). Showing the closest
  // candidates beats an empty grid — SQL already ordered them by similarity.
  if (hits.length === 0 && docs.length > 0 && q.length >= 3) {
    const docOrder = new Map(candidateIds.map((id, i) => [id, i]))
    hits = docs
      .slice()
      .sort((a, b) => (docOrder.get(a.listingId) ?? 999) - (docOrder.get(b.listingId) ?? 999))
      .slice(0, Math.min(limit, 12))
      .map((doc, i) => ({ listingId: doc.listingId, score: 1 - i * 0.01 }))
  }

  console.log("[marketplace-search]", {
    q: q.slice(0, 48),
    candidates: candidateIds.length,
    hits: hits.length,
    bridgeTerms: bridgeTerms.length,
    scopeCategoryId: scopeId ?? null,
  })
  return hits
}

export function orderByListingSearchHits(
  listingIds: string[],
  hits: MarketplaceSearchHit[]
): string[] {
  const rank = new Map(hits.map((h, i) => [h.listingId, h.score * 1000 - i]))
  return [...listingIds].sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0))
}

/** Autocomplete: top product titles + category paths. */
export async function marketplaceSearchSuggestions(
  rawQuery: string,
  limit = 8
): Promise<{
  products: Array<{ listingId: string; title: string; image: string | null; price: number }>
  categories: Array<{ id: string; breadcrumb: string }>
}> {
  const hits = await withPrismaReconnect(() =>
    searchMarketplaceListingHits(rawQuery, { limit: Math.min(limit, 12) })
  )
  if (hits.length === 0) {
    return { products: [], categories: [] }
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: { id: { in: hits.map((h) => h.listingId) } },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: { select: { name: true, images: true } },
    },
  })
  const order = new Map(hits.map((h, i) => [h.listingId, i]))
  listings.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))

  const products = listings.slice(0, limit).map((row) => ({
    listingId: row.id,
    title: listingDisplayTitle(row.customTitle, row.product.name),
    image: row.customImages?.[0] ?? row.product.images?.[0] ?? null,
    price: row.sellingPriceCents / 100,
  }))

  const q = rawQuery.trim()
  const categoryRows =
    q.length >= 2
      ? await prisma.category.findMany({
          where: {
            isLeaf: true,
            OR: [
              { fullPath: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, fullPath: true },
          orderBy: { fullPath: "asc" },
          take: 6,
        })
      : []

  return {
    products,
    categories: categoryRows.map((c) => ({ id: c.id, breadcrumb: c.fullPath })),
  }
}
