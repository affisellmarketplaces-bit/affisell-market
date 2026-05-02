import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MS_DAY = 24 * 60 * 60 * 1000

type RankRow = { productId: string; c: bigint }

export async function GET() {
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * MS_DAY)
  const sevenDaysAgo = new Date(now - 7 * MS_DAY)

  const ranked = await prisma.$queryRaw<RankRow[]>`
    SELECT o."productId", COUNT(*)::bigint AS c
    FROM "Order" o
    INNER JOIN "Product" p ON p.id = o."productId"
    WHERE o."createdAt" >= ${thirtyDaysAgo}
      AND p.active = true
    GROUP BY o."productId"
    ORDER BY c DESC
    LIMIT 20
  `

  const sorted = ranked.map((r) => ({ productId: r.productId, _count: { id: Number(r.c) } }))
  const productIds = sorted.map((g) => g.productId)
  if (productIds.length === 0) {
    return Response.json({ items: [] })
  }

  const [products, weekCounts] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: {
        supplier: {
          include: { store: { select: { name: true, slug: true, logoUrl: true } } },
        },
      },
    }),
    prisma.order.groupBy({
      by: ["productId"],
      where: {
        createdAt: { gte: sevenDaysAgo },
        productId: { in: productIds },
      },
      _count: { id: true },
    }),
  ])

  const weekMap = new Map(weekCounts.map((w) => [w.productId, w._count.id]))
  const productMap = new Map(products.map((p) => [p.id, p]))
  const countMap = new Map(sorted.map((g) => [g.productId, g._count.id]))

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      isListed: true,
      product: { active: true },
    },
    select: { id: true, productId: true },
    orderBy: { id: "asc" },
  })
  const firstListingByProduct = new Map<string, string>()
  for (const l of listings) {
    if (!firstListingByProduct.has(l.productId)) {
      firstListingByProduct.set(l.productId, l.id)
    }
  }

  const items = productIds
    .map((id) => {
      const p = productMap.get(id)
      if (!p) return null
      const totalSold = countMap.get(id) ?? 0
      const soldThisWeek = weekMap.get(id) ?? 0
      const listingId = firstListingByProduct.get(id)
      return {
        id: p.id,
        name: p.name,
        imageUrl: primaryProductImage(p.images) || null,
        priceCents: p.basePriceCents,
        totalSold,
        soldThisWeek,
        href: listingId ? `/marketplace/${listingId}` : "/marketplace",
        store: p.supplier.store
          ? {
              name: p.supplier.store.name,
              slug: p.supplier.store.slug,
              logoUrl: p.supplier.store.logoUrl,
            }
          : null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  return Response.json({ items })
}
