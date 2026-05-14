import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
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
      ...affiliateRoleMarketplaceWhere,
      productId: { in: productIds },
      isListed: true,
      product: { active: true },
    },
    include: {
      affiliate: { include: { store: { select: { name: true, slug: true, logoUrl: true, aiAvatarUrl: true } } } },
    },
    orderBy: { id: "asc" },
  })

  const firstByProduct = new Map<
    string,
    {
      listingId: string
      sellingPriceCents: number
      store: { name: string; slug: string; logoUrl: string | null; aiAvatarUrl: string | null } | null
    }
  >()
  for (const l of listings) {
    if (firstByProduct.has(l.productId)) continue
    const st = l.affiliate.store
    firstByProduct.set(l.productId, {
      listingId: l.id,
      sellingPriceCents: l.sellingPriceCents,
      store: st ? { name: st.name, slug: st.slug, logoUrl: st.logoUrl, aiAvatarUrl: st.aiAvatarUrl } : null,
    })
  }

  const items = productIds
    .map((id) => {
      const p = productMap.get(id)
      const meta = firstByProduct.get(id)
      if (!p || !meta) return null
      const totalSold = countMap.get(id) ?? 0
      const soldThisWeek = weekMap.get(id) ?? 0
      return {
        id: p.id,
        name: p.name,
        imageUrl: primaryProductImage(p.images) || null,
        priceCents: meta.sellingPriceCents,
        totalSold,
        soldThisWeek,
        href: `/marketplace/${meta.listingId}`,
        store: meta.store,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  return Response.json({ items })
}
