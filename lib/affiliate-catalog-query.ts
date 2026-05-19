import type { Prisma } from "@prisma/client"

import { affiliateDiscoverCardSelect } from "@/lib/affiliate-dashboard-data"
import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

const MS_DAY = 24 * 60 * 60 * 1000

export const AFFILIATE_CATALOG_NICHES = {
  fitness: ["fitness", "sport", "Fitness", "Sport", "Exercise", "gym"],
  tech: ["électronique", "electronique", "informatique", "tech", "Électronique", "Informatique", "Gaming"],
  maison: ["maison", "Maison", "déco", "décor", "mobilier", "cuisine", "home", "jardin"],
} as const

export type AffiliateCatalogNiche = keyof typeof AFFILIATE_CATALOG_NICHES

export type AffiliateCatalogProduct = {
  id: string
  name: string
  images: string[]
  categories: string[]
  colors: string[]
  tags: string[]
  basePriceCents: number
  commissionRate: number
  deliveryMax: number | null
  createdAt: string
  affiliateProducts: { id: string; isListed: boolean }[]
  supplier: {
    email: string
    store: { name: string; slug: string } | null
  }
}

export type AffiliateCatalogHighlightCard = {
  productId: string
  name: string
  imageUrl: string | null
  basePriceCents: number
  commissionRate: number
  marginCents: number
  soldCount: number
  isInStore: boolean
  listingId: string | null
  supplierLabel: string
}

export type AffiliateCatalogHighlights = {
  bestSellers7d: AffiliateCatalogHighlightCard[]
  newArrivals: AffiliateCatalogHighlightCard[]
  highMargin: AffiliateCatalogHighlightCard[]
}

type DiscoverRow = Awaited<
  ReturnType<
    typeof prisma.product.findMany<{ select: ReturnType<typeof affiliateDiscoverCardSelect> }>
  >
>[number]

function normalizeCatalogRow(row: DiscoverRow): AffiliateCatalogProduct {
  const supplier = row.supplier as unknown as {
    email: string
    store: { name: string; slug: string } | null
  }
  return {
    id: row.id,
    name: row.name,
    images: row.images ?? [],
    categories: row.categories ?? [],
    colors: row.colors ?? [],
    tags: row.tags ?? [],
    basePriceCents: row.basePriceCents,
    commissionRate: Number(row.commissionRate) || 0,
    deliveryMax: row.deliveryMax,
    createdAt: row.createdAt.toISOString(),
    affiliateProducts: (row.affiliateProducts ?? []).map((a) => ({
      id: a.id,
      isListed: a.isListed,
    })),
    supplier: {
      email: supplier.email,
      store: supplier.store,
    },
  }
}

function supplierLabel(p: AffiliateCatalogProduct): string {
  const brand = p.supplier.store?.name?.trim()
  if (brand) return brand
  return p.supplier.email
}

function estimateMarginCents(basePriceCents: number, commissionRate: number): number {
  const pct = Number(commissionRate) || 0
  return Math.max(0, Math.round((basePriceCents * pct) / 100))
}

function mapProductToHighlight(
  p: AffiliateCatalogProduct,
  soldCount: number
): AffiliateCatalogHighlightCard {
  const listing = p.affiliateProducts[0]
  return {
    productId: p.id,
    name: p.name,
    imageUrl: primaryProductImage(p.images) || null,
    basePriceCents: p.basePriceCents,
    commissionRate: Math.round(Number(p.commissionRate) || 0),
    marginCents: estimateMarginCents(p.basePriceCents, p.commissionRate),
    soldCount,
    isInStore: Boolean(listing),
    listingId: listing?.id ?? null,
    supplierLabel: supplierLabel(p),
  }
}

export async function buildAffiliateCatalogProductWhere(
  searchParams: URLSearchParams
): Promise<Prisma.ProductWhereInput> {
  const categoryId = searchParams.get("categoryId") ?? searchParams.get("category")
  const subcategoryId = searchParams.get("subcategoryId") ?? searchParams.get("subcategory")
  const scopeRootId = subcategoryId ?? categoryId
  const q = (searchParams.get("q") ?? "").trim()
  const nicheRaw = (searchParams.get("niche") ?? "").trim().toLowerCase() as AffiliateCatalogNiche

  const andParts: Prisma.ProductWhereInput[] = [{ active: true, isDraft: false }]

  if (scopeRootId) {
    const scope = await buildCategoryScopeProductFilter(prisma, scopeRootId)
    andParts.push(scope)
  }

  const nicheHints =
    nicheRaw && nicheRaw in AFFILIATE_CATALOG_NICHES
      ? AFFILIATE_CATALOG_NICHES[nicheRaw]
      : null

  if (nicheHints) {
    andParts.push({
      OR: [
        { categories: { hasSome: [...nicheHints] } },
        ...nicheHints.map((hint) => ({
          name: { contains: hint, mode: "insensitive" as const },
        })),
      ],
    })
  }

  if (q) {
    andParts.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { categories: { hasSome: [q] } },
        { tags: { hasSome: [q] } },
      ],
    })
  }

  return { AND: andParts }
}

export async function loadAffiliateCatalogProducts(
  affiliateId: string,
  searchParams: URLSearchParams,
  take = 96
): Promise<AffiliateCatalogProduct[]> {
  const where = await buildAffiliateCatalogProductWhere(searchParams)
  const sort = searchParams.get("sort")?.trim() ?? "new"

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "commission-desc"
      ? [{ commissionRate: "desc" }, { createdAt: "desc" }]
      : sort === "price-asc"
        ? [{ basePriceCents: "asc" }]
        : sort === "price-desc"
          ? [{ basePriceCents: "desc" }]
          : sort === "name"
            ? [{ name: "asc" }]
            : [{ createdAt: "desc" }]

  const rows = await prisma.product.findMany({
    where,
    select: affiliateDiscoverCardSelect(affiliateId),
    orderBy,
    take,
  })

  return rows.map(normalizeCatalogRow)
}

async function soldCountsSince(since: Date, productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()
  const rows = await prisma.order.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, createdAt: { gte: since } },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.productId, r._count.id]))
}

async function loadScopedProducts(
  affiliateId: string,
  searchParams: URLSearchParams,
  take: number,
  orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[]
): Promise<AffiliateCatalogProduct[]> {
  const where = await buildAffiliateCatalogProductWhere(searchParams)
  const rows = await prisma.product.findMany({
    where,
    select: affiliateDiscoverCardSelect(affiliateId),
    orderBy,
    take,
  })
  return rows.map(normalizeCatalogRow)
}

export async function loadAffiliateCatalogHighlights(
  affiliateId: string,
  searchParams: URLSearchParams,
  limit = 12
): Promise<AffiliateCatalogHighlights> {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_DAY)
  const baseWhere = await buildAffiliateCatalogProductWhere(searchParams)

  const ranked = await prisma.$queryRaw<{ productId: string; c: bigint }[]>`
    SELECT o."productId", COUNT(*)::bigint AS c
    FROM "Order" o
    INNER JOIN "Product" p ON p.id = o."productId"
    WHERE o."createdAt" >= ${sevenDaysAgo}
      AND p.active = true
      AND p."isDraft" = false
    GROUP BY o."productId"
    ORDER BY c DESC
    LIMIT ${limit * 4}
  `

  const rankedIds = ranked.map((r) => r.productId)

  const [bestRows, newRows, marginRows] = await Promise.all([
    rankedIds.length > 0
      ? prisma.product.findMany({
          where: { AND: [baseWhere, { id: { in: rankedIds } }] },
          select: affiliateDiscoverCardSelect(affiliateId),
          take: limit * 2,
        })
      : Promise.resolve([]),
    loadScopedProducts(affiliateId, searchParams, limit, { createdAt: "desc" }),
    loadScopedProducts(affiliateId, searchParams, limit * 3, { commissionRate: "desc" }),
  ])

  const soldMap = await soldCountsSince(sevenDaysAgo, rankedIds)

  const bestSorted = bestRows
    .map((r) => ({
      row: normalizeCatalogRow(r),
      rank: rankedIds.indexOf(r.id),
    }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.row)

  const bestFallback = bestSorted.length > 0 ? bestSorted : marginRows.slice(0, limit)

  const marginSorted = [...marginRows].sort(
    (a, b) =>
      estimateMarginCents(b.basePriceCents, b.commissionRate) -
      estimateMarginCents(a.basePriceCents, a.commissionRate)
  )

  return {
    bestSellers7d: bestFallback.map((p) =>
      mapProductToHighlight(p, soldMap.get(p.id) ?? 0)
    ),
    newArrivals: newRows.slice(0, limit).map((p) => mapProductToHighlight(p, 0)),
    highMargin: marginSorted.slice(0, limit).map((p) => mapProductToHighlight(p, 0)),
  }
}
