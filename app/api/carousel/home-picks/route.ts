import { auth } from "@/auth"
import { mapListingToCarousel, viewCountsToday } from "@/lib/carousel-mapper"
import type { CarouselItemJson } from "@/lib/carousel-types"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MS_DAY = 24 * 60 * 60 * 1000

const NICHE_FILTERS: Record<string, string[]> = {
  fitness: ["fitness", "sport", "Fitness", "Sport", "Exercise"],
  tech: ["électronique", "electronique", "informatique", "tech", "Électronique", "Informatique", "Gaming"],
  maison: ["maison", "Maison", "déco", "décor", "mobilier", "cuisine", "home"],
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    const niche = new URL(req.url).searchParams.get("niche")?.trim().toLowerCase() || "fitness"
    const categoryHints = NICHE_FILTERS[niche] ?? NICHE_FILTERS.fitness!
    const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY)

    let productIds: string[] = []

    let affiliateCategoryHints: string[] = []
    if (session?.user?.role === "AFFILIATE" && session.user.id) {
      const [listed, history] = await Promise.all([
        prisma.affiliateProduct.findMany({
          where: { affiliateId: session.user.id },
          select: { product: { select: { categories: true } } },
          take: 40,
        }),
        prisma.searchHistory.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { productId: true },
        }),
      ])
      const viewedIds = history.map((h) => h.productId).filter(Boolean) as string[]
      const viewedProducts =
        viewedIds.length > 0
          ? await prisma.product.findMany({
              where: { id: { in: viewedIds }, active: true },
              select: { categories: true },
            })
          : []
      affiliateCategoryHints = [
        ...new Set([
          ...listed.flatMap((l) => l.product.categories),
          ...viewedProducts.flatMap((p) => p.categories),
        ]),
      ].filter(Boolean)
    }

    const nicheFilter = categoryHints
    const personalized =
      affiliateCategoryHints.length > 0
        ? affiliateCategoryHints.filter((c) =>
            nicheFilter.some(
              (h) =>
                c.toLowerCase().includes(h.toLowerCase()) || h.toLowerCase().includes(c.toLowerCase())
            )
          )
        : []
    const categoriesToMatch =
      personalized.length > 0 ? personalized : nicheFilter

    const inNiche = await prisma.affiliateProduct.findMany({
      where: {
        ...affiliateRoleMarketplaceWhere,
        isListed: true,
        product: {
          active: true,
          categories: { hasSome: categoriesToMatch },
        },
      },
      select: { productId: true },
      take: 60,
    })
    productIds = [...new Set(inNiche.map((r) => r.productId))]

    if (productIds.length === 0) {
      productIds = await topSoldProductIds(thirtyDaysAgo, 12)
    } else {
      const sold = await prisma.order.groupBy({
        by: ["productId"],
        where: {
          productId: { in: productIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { id: true },
      })
      const soldMap = new Map(sold.map((s) => [s.productId, s._count.id]))
      productIds.sort((a, b) => (soldMap.get(b) ?? 0) - (soldMap.get(a) ?? 0))
      productIds = productIds.slice(0, 12)
    }

    return Response.json(await packListings(productIds))
  } catch (e) {
    console.error("[api/carousel/home-picks]", e)
    return Response.json(
      { items: [] as CarouselItemJson[], ...dbUnavailablePayload(e) },
      { status: 503 }
    )
  }
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

async function packListings(productIds: string[]): Promise<{ items: CarouselItemJson[] }> {
  if (productIds.length === 0) return { items: [] }

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

  const byProduct = new Map(listings.map((l) => [l.productId, l]))
  const order = productIds.map((id) => byProduct.get(id)).filter(Boolean) as typeof listings
  const pids = order.map((l) => l.productId)
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY)

  const [viewsMap, soldRows] = await Promise.all([
    viewCountsToday(prisma, pids),
    prisma.order.groupBy({
      by: ["productId"],
      where: { productId: { in: pids }, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
  ])
  const soldMap = new Map(soldRows.map((s) => [s.productId, s._count.id]))

  const items = order.map((row) =>
    mapListingToCarousel(row, {
      viewsToday: viewsMap.get(row.productId) ?? 0,
      sold30d: soldMap.get(row.productId) ?? 0,
      contextQuery: null,
      aiPick: true,
    })
  )

  return { items }
}
