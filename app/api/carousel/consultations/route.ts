import { auth } from "@/auth"
import { mapListingToCarousel, viewCountsToday } from "@/lib/carousel-mapper"
import type { CarouselItemJson } from "@/lib/carousel-types"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MS_DAY = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() || null

  const historyWhere = userId ? { userId } : sessionId ? { sessionId } : null
  if (!historyWhere) {
    return Response.json({ items: [] as CarouselItemJson[], recommendationQuery: null as string | null })
  }

  const history = await prisma.searchHistory.findMany({
    where: historyWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { productId: true, query: true },
  })

  const recommendationQuery = history[0]?.query?.trim() || null
  const viewedPids = [...new Set(history.map((h) => h.productId).filter(Boolean))] as string[]

  const viewedProducts =
    viewedPids.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: viewedPids }, active: true },
          select: { categories: true },
        })
      : []

  const categoryList = [
    ...new Set(viewedProducts.flatMap((p) => p.categories).filter((c) => typeof c === "string" && c.trim())),
  ]

  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY)

  if (categoryList.length === 0) {
    const ids = await topSoldProductIds(thirtyDaysAgo, 12)
    return Response.json(await packListings(ids, recommendationQuery, false))
  }

  const inCategoryRows = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: {
        active: true,
        categories: { hasSome: categoryList },
      },
    },
    select: { productId: true },
    take: 80,
    orderBy: [{ product: { stock: "desc" } }, { id: "desc" }],
  })
  const candidateIds = [...new Set(inCategoryRows.map((r) => r.productId))]

  if (candidateIds.length === 0) {
    const ids = await topSoldProductIds(thirtyDaysAgo, 12)
    return Response.json(await packListings(ids, recommendationQuery, false))
  }

  const sold = await prisma.order.groupBy({
    by: ["productId"],
    where: {
      productId: { in: candidateIds },
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
  })
  const soldMap = new Map(sold.map((s) => [s.productId, s._count.id]))
  candidateIds.sort((a, b) => (soldMap.get(b) ?? 0) - (soldMap.get(a) ?? 0))

  return Response.json(await packListings(candidateIds.slice(0, 12), recommendationQuery, false))
}

async function topSoldProductIds(since: Date, take: number): Promise<string[]> {
  const ranked = await prisma.$queryRaw<{ productId: string; c: bigint }[]>`
    SELECT o."productId", COUNT(*)::bigint AS c
    FROM "Order" o
    INNER JOIN "Product" p ON p.id = o."productId"
    WHERE o."createdAt" >= ${since} AND p.active = true
    GROUP BY o."productId"
    ORDER BY c DESC
    LIMIT ${take}
  `
  return ranked.map((r) => r.productId)
}

async function packListings(
  productIds: string[],
  recommendationQuery: string | null,
  aiPick: boolean
): Promise<{ items: CarouselItemJson[]; recommendationQuery: string | null }> {
  if (productIds.length === 0) {
    return { items: [], recommendationQuery }
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: { active: true, id: { in: productIds } },
    },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          basePriceCents: true,
          images: true,
          stock: true,
          deliveryMin: true,
          deliveryMax: true,
          freeShipping: true,
        },
      },
    },
  })

  const byProduct = new Map<string, (typeof listings)[0]>()
  for (const l of listings) {
    if (!byProduct.has(l.productId)) byProduct.set(l.productId, l)
  }

  const order: typeof listings = []
  for (const pid of productIds) {
    const l = byProduct.get(pid)
    if (l) order.push(l)
  }

  const pids = order.map((l) => l.productId)
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY)
  const [viewsMap, soldRows] = await Promise.all([
    viewCountsToday(prisma, pids),
    prisma.order.groupBy({
      by: ["productId"],
      where: {
        productId: { in: pids },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    }),
  ])
  const soldMap = new Map(soldRows.map((s) => [s.productId, s._count.id]))

  const items = order.map((row) =>
    mapListingToCarousel(row, {
      viewsToday: viewsMap.get(row.productId) ?? 0,
      sold30d: soldMap.get(row.productId) ?? 0,
      contextQuery: recommendationQuery,
      aiPick,
    })
  )

  return { items, recommendationQuery }
}
