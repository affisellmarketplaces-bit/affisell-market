import type { Prisma } from "@prisma/client"

import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import {
  buildMarketplaceScopedProductWhere,
  parseMarketplaceAttributeFilters,
} from "@/lib/marketplace-attribute-filters"
import {
  parseProductCustomColumnFilters,
  productCustomColumnFilterClauses,
} from "@/lib/product-custom-column-filters"
import { prisma } from "@/lib/prisma"
import { publicStoreLabelFromAffiliateRow } from "@/lib/public-seller-display"

export const listingMarketplaceInclude = {
  product: {
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      compareAt: true,
      stock: true,
      categoryId: true,
    },
  },
  affiliate: {
    select: {
      name: true,
      store: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.AffiliateProductInclude

export type MarketplaceListingRow = Prisma.AffiliateProductGetPayload<{
  include: typeof listingMarketplaceInclude
}>

export function serializeMarketplaceListing(row: MarketplaceListingRow) {
  const p = row.product
  const compareNum = p.compareAt != null ? Number(p.compareAt) : null
  const gallery = listingGalleryUrls(row.customImages ?? [], p.images ?? [])
  const title = listingDisplayTitle(row.customTitle, p.name)

  return {
    id: row.id,
    listingId: row.id,
    productId: p.id,
    name: title,
    title,
    price: row.sellingPriceCents / 100,
    sellingPriceCents: row.sellingPriceCents,
    compareAt: compareNum != null && Number.isFinite(compareNum) ? compareNum : null,
    image: gallery[0] ?? null,
    images: gallery,
    stock: p.stock,
    store: publicStoreLabelFromAffiliateRow(row.affiliate),
    isBestSeller: row.isFeatured,
    storeSlug: row.affiliate.store?.slug ?? null,
    buyerRewardBadge: buyerRewardBadgeText(
      normalizeBuyerRewardKind(row.buyerRewardKind),
      row.buyerRewardPercent ?? 0
    ),
  }
}

export async function buildMarketplaceAffiliateWhereFromUrl(
  searchParams: URLSearchParams
): Promise<Prisma.AffiliateProductWhereInput> {
  const categoryId = searchParams.get("categoryId") ?? searchParams.get("category")
  const subcategoryId = searchParams.get("subcategoryId") ?? searchParams.get("subcategory")
  const scopeRootId = subcategoryId ?? categoryId
  const q = (searchParams.get("q") ?? "").trim()

  const attributeFilters = parseMarketplaceAttributeFilters(searchParams)
  const customColumnFilters = parseProductCustomColumnFilters(searchParams)
  const productWhere = await buildMarketplaceScopedProductWhere(scopeRootId, attributeFilters)
  const ccClauses = productCustomColumnFilterClauses(customColumnFilters)
  const productWhereWithCustom: Prisma.ProductWhereInput =
    ccClauses.length > 0 ? { AND: [productWhere, ...ccClauses] } : productWhere

  const andParts: Prisma.AffiliateProductWhereInput[] = [
    affiliateRoleMarketplaceWhere,
    { isListed: true },
    { product: productWhereWithCustom },
  ]

  if (q) {
    andParts.push({
      OR: [
        { customTitle: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
        { product: { description: { contains: q, mode: "insensitive" } } },
      ],
    })
  }

  return { AND: andParts }
}

export async function fetchMarketplaceListings(searchParams: URLSearchParams, take = 120) {
  const where = await buildMarketplaceAffiliateWhereFromUrl(searchParams)
  const rows = await prisma.affiliateProduct.findMany({
    where,
    include: listingMarketplaceInclude,
    orderBy: [{ isFeatured: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
    take,
  })
  return rows.map(serializeMarketplaceListing)
}
