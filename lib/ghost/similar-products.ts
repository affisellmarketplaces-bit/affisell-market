import { shopListingPath } from "@/lib/affiliate-routes"
import {
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

export type GhostAlternative = {
  affiliateProductId: string
  title: string
  image: string | null
  priceCents: number
  href: string
}

/** 3 in-stock listings in the same category (Ghost OOS recovery). */
export async function getSimilarInStockProducts(
  productId: string,
  take = 3
): Promise<GhostAlternative[]> {
  const seed = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      categoryId: true,
      categories: true,
    },
  })
  if (!seed) return []

  const categoryFilter =
    seed.categoryId || seed.categories[0]
      ? {
          OR: [
            ...(seed.categoryId ? [{ categoryId: seed.categoryId }] : []),
            ...(seed.categories[0]
              ? [{ categories: { has: seed.categories[0] } }]
              : []),
          ],
        }
      : {}

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      productId: { not: productId },
      product: {
        active: true,
        isDraft: false,
        ...categoryFilter,
        AND: [
          {
            OR: [
              { lastStockStatus: { in: ["in_stock", "low_stock"] } },
              { lastStockStatus: null },
            ],
          },
        ],
      },
    },
    include: {
      product: { select: { name: true, images: true, basePriceCents: true } },
      affiliate: { select: { store: { select: { slug: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: take * 4,
  })

  const out: GhostAlternative[] = []
  for (const row of listings) {
    const slug = row.affiliate.store?.slug
    if (!slug) continue
    const gallery = listingGalleryUrls(row.customImages, row.product.images)
    out.push({
      affiliateProductId: row.id,
      title: listingDisplayTitle(row.customTitle, row.product.name),
      image: gallery[0] ?? null,
      priceCents: row.sellingPriceCents || row.product.basePriceCents,
      href: shopListingPath(slug, row.id),
    })
    if (out.length >= take) break
  }
  return out
}
