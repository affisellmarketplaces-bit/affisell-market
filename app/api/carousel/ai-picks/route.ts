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
  const history = historyWhere
    ? await prisma.searchHistory.findMany({
        where: historyWhere,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { query: true },
      })
    : []

  const ctxQuery = history[0]?.query?.trim() || null
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY)

  const trendingIds = await topSoldProductIds(thirtyDaysAgo, 10)
  const extraRows = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: {
        active: true,
        ...(trendingIds.length ? { id: { notIn: trendingIds } } : {}),
      },
    },
    take: 8,
    orderBy: [{ product: { stock: "desc" } }, { createdAt: "desc" }],
    select: { productId: true },
  })
  const extra = extraRows.map((e) => e.productId)
  const merged = [...trendingIds, ...extra]
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of merged) {
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
    if (unique.length >= 12) break
  }

  if (unique.length === 0) {
    return Response.json({ items: [] as CarouselItemJson[], recommendationQuery: ctxQuery })
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: { active: true, id: { in: unique } },
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

  const byProduct = new Map(listings.map((l) => [l.productId, l]))
  const order = unique.map((id) => byProduct.get(id)).filter(Boolean) as typeof listings

  const pids = order.map((l) => l.productId)
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
      contextQuery: ctxQuery,
      aiPick: true,
    })
  )

  return Response.json({ items, recommendationQuery: ctxQuery })
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
