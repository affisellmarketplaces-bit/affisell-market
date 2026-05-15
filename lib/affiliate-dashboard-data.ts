import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

/** Fields needed for discover grid + listing builder — excludes heavy media / review blobs. */
export function affiliateCatalogProductSelect(affiliateId: string): Prisma.ProductSelect {
  return {
    id: true,
    name: true,
    description: true,
    images: true,
    categories: true,
    colors: true,
    tags: true,
    variants: true,
    basePriceCents: true,
    commissionRate: true,
    deliveryMax: true,
    createdAt: true,
    affiliateProducts: {
      where: { affiliateId },
      select: { id: true, isListed: true },
    },
    supplier: {
      select: {
        email: true,
        store: { select: { name: true, slug: true } },
      },
    },
  }
}

export const affiliateListingProductSelect = {
  id: true,
  name: true,
  description: true,
  images: true,
  categories: true,
  colors: true,
  tags: true,
  variants: true,
  basePriceCents: true,
  commissionRate: true,
  deliveryMax: true,
  createdAt: true,
  supplier: {
    select: {
      email: true,
      store: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.ProductSelect

const affiliateListingRowSelect = {
  id: true,
  productId: true,
  sellingPriceCents: true,
  customTitle: true,
  customDescription: true,
  customImages: true,
  customSlug: true,
  seoTitle: true,
  seoDescription: true,
  collections: true,
  isListed: true,
  isFeatured: true,
  clicks: true,
  conversions: true,
  position: true,
  buyerRewardKind: true,
  buyerRewardPercent: true,
  promotedColor: true,
  promotedSize: true,
} satisfies Prisma.AffiliateProductSelect

export const AFFILIATE_DISCOVER_CATALOG_LIMIT = 48

export async function loadAffiliateDiscoverCatalog(affiliateId: string, opts?: { take?: number }) {
  const take = opts?.take ?? AFFILIATE_DISCOVER_CATALOG_LIMIT
  return prisma.product.findMany({
    where: { active: true, isDraft: false },
    select: affiliateCatalogProductSelect(affiliateId),
    orderBy: { createdAt: "desc" },
    take,
  })
}

/** Listings with nested product — one product query, no duplicate catalog fetch. */
export async function loadAffiliateDashboardListings(affiliateId: string) {
  const rows = await prisma.affiliateProduct.findMany({
    where: { affiliateId },
    select: affiliateListingRowSelect,
    orderBy: [{ position: "asc" }, { id: "asc" }],
  })

  const productIds = [...new Set(rows.map((r) => r.productId))]
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: affiliateListingProductSelect,
        })
      : []
  const byId = new Map(products.map((p) => [p.id, p]))

  return rows.map((row) => ({
    ...row,
    product: byId.get(row.productId) ?? null,
  }))
}
