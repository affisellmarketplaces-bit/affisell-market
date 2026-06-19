import type { Prisma } from "@prisma/client"

import { filterListingsForAffiliate, requireMerchantUserId } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"

const supplierPick = {
  select: {
    email: true,
    store: { select: { name: true, slug: true } },
  },
} as const

/** Discover grid cards — no long description / variants JSON. */
export function affiliateDiscoverCardSelect(affiliateId: string): Prisma.ProductSelect {
  return {
    id: true,
    name: true,
    images: true,
    categories: true,
    colors: true,
    tags: true,
    basePriceCents: true,
    commissionRate: true,
    variants: true,
    deliveryMax: true,
    createdAt: true,
    affiliateProducts: {
      where: { affiliateId },
      select: { id: true, isListed: true },
    },
    supplier: supplierPick,
  }
}

/** Listing builder / edit modal — single product, loaded on demand. */
export function affiliateCatalogProductDetailSelect(affiliateId: string): Prisma.ProductSelect {
  return {
    ...affiliateDiscoverCardSelect(affiliateId),
    description: true,
    variants: true,
    hasVariants: true,
    productVariants: {
      select: { color: true, size: true, stock: true, customData: true },
      orderBy: { createdAt: "asc" },
    },
  }
}

/** My storefront cards — minimal nested product payload. */
export const affiliateListingCardProductSelect = {
  id: true,
  name: true,
  images: true,
  colors: true,
  basePriceCents: true,
  commissionRate: true,
  deliveryMax: true,
  supplier: supplierPick,
} satisfies Prisma.ProductSelect

const affiliateListingRowSelect = {
  id: true,
  affiliateId: true,
  productId: true,
  sellingPriceCents: true,
  customTitle: true,
  customDescription: true,
  customImages: true,
  customSlug: true,
  seoTitle: true,
  seoDescription: true,
  collections: true,
  luxuryTier: true,
  luxuryCollectionId: true,
  isListed: true,
  isFeatured: true,
  auctionEligible: true,
  clicks: true,
  conversions: true,
  position: true,
  buyerRewardKind: true,
  buyerRewardPercent: true,
  promotedColor: true,
  promotedSize: true,
  promotedVariantKeys: true,
  showWarranty: true,
} satisfies Prisma.AffiliateProductSelect

export const AFFILIATE_DISCOVER_CATALOG_LIMIT = 24

export async function loadAffiliateDiscoverCatalog(affiliateUserId: string, opts?: { take?: number }) {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const take = opts?.take ?? AFFILIATE_DISCOVER_CATALOG_LIMIT
  return prisma.product.findMany({
    where: { active: true, isDraft: false },
    select: affiliateDiscoverCardSelect(affiliateId),
    orderBy: { createdAt: "desc" },
    take,
  })
}

/** Listings + slim product rows (two small queries). */
export async function loadAffiliateDashboardListings(affiliateUserId: string) {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const rows = filterListingsForAffiliate(
    await prisma.affiliateProduct.findMany({
      where: { affiliateId },
      select: affiliateListingRowSelect,
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    affiliateId
  )

  const productIds = [...new Set(rows.map((r) => r.productId))]
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: affiliateListingCardProductSelect,
        })
      : []
  const byId = new Map(products.map((p) => [p.id, p]))

  return rows.map((row) => ({
    ...row,
    product: byId.get(row.productId) ?? null,
  }))
}
