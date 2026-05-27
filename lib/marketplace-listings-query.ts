import type { Prisma } from "@prisma/client"

import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { parseMarketplaceAttributeFilters } from "@/lib/marketplace-attribute-filters"
import { buildMarketplaceScopedProductWhere } from "@/lib/marketplace-attribute-filters.server"
import {
  parseProductCustomColumnFilters,
  productCustomColumnFilterClauses,
} from "@/lib/product-custom-column-filters"
import {
  listingWarrantyBadgeLabel,
  resolveProductWarrantyMonths,
} from "@/lib/product-warranty"
import { prisma } from "@/lib/prisma"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
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
      variants: true,
      hasVariants: true,
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

/** Home `#explorer` — smaller payload for mobile RSC/hydration. */
export const HOME_MARKETPLACE_LISTINGS_TAKE = 24

export const listingMarketplaceIncludeLite = {
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      compareAt: true,
      stock: true,
      categoryId: true,
      hasVariants: true,
    },
  },
  affiliate: {
    select: {
      name: true,
      store: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.AffiliateProductInclude

export type MarketplaceListingRowLite = Prisma.AffiliateProductGetPayload<{
  include: typeof listingMarketplaceIncludeLite
}>

export function serializeMarketplaceListing(
  row: MarketplaceListingRow | MarketplaceListingRowLite,
  options?: { warrantyMonths?: number | null; locale?: string; lite?: boolean }
) {
  const p = row.product
  const compareNum = p.compareAt != null ? Number(p.compareAt) : null
  const gallery = listingGalleryUrls(row.customImages ?? [], p.images ?? [])
  const title = listingDisplayTitle(row.customTitle, p.name)
  const warrantyMonths =
    options?.warrantyMonths !== undefined
      ? options.warrantyMonths
      : options?.lite
        ? null
        : resolveProductWarrantyMonths({
            variants: "variants" in p ? p.variants : undefined,
            hasVariants: p.hasVariants,
          })

  const base = {
    id: row.id,
    listingId: row.id,
    productId: p.id,
    name: title,
    title,
    price: row.sellingPriceCents / 100,
    sellingPriceCents: row.sellingPriceCents,
    compareAt: compareNum != null && Number.isFinite(compareNum) ? compareNum : null,
    image: gallery[0] ?? null,
    stock: p.stock,
    store: publicStoreLabelFromAffiliateRow(row.affiliate),
    isBestSeller: row.isFeatured,
    storeSlug: row.affiliate.store?.slug ?? null,
    buyerRewardBadge: buyerRewardBadgeText(
      normalizeBuyerRewardKind(row.buyerRewardKind),
      row.buyerRewardPercent ?? 0
    ),
    warrantyLabel: listingWarrantyBadgeLabel(
      row.showWarranty,
      warrantyMonths,
      options?.locale ?? "fr"
    ),
    soldCount: normalizeListingSalesCount(row.conversions),
  }

  if (options?.lite) {
    return base
  }

  return {
    ...base,
    images: gallery,
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
    buyerListedAffiliateProductWhere,
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

export async function fetchMarketplaceListings(
  searchParams: URLSearchParams,
  take = 120,
  options?: { lite?: boolean }
) {
  const where = await buildMarketplaceAffiliateWhereFromUrl(searchParams)
  const lite = options?.lite === true
  const rows = lite
    ? await prisma.affiliateProduct.findMany({
        where,
        include: listingMarketplaceIncludeLite,
        orderBy: [{ isFeatured: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
        take,
      })
    : await prisma.affiliateProduct.findMany({
        where,
        include: listingMarketplaceInclude,
        orderBy: [{ isFeatured: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
        take,
      })

  if (lite) {
    return (rows as MarketplaceListingRowLite[]).map((row) =>
      serializeMarketplaceListing(row, { lite: true })
    )
  }

  const fullRows = rows as MarketplaceListingRow[]
  const variantProductIds = [
    ...new Set(fullRows.filter((r) => r.product.hasVariants).map((r) => r.product.id)),
  ]
  const variantRows =
    variantProductIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { productId: { in: variantProductIds } },
          select: { productId: true, customData: true },
        })
      : []
  const variantsByProductId = new Map<string, Array<{ customData: unknown }>>()
  for (const variant of variantRows) {
    const list = variantsByProductId.get(variant.productId) ?? []
    list.push({ customData: variant.customData })
    variantsByProductId.set(variant.productId, list)
  }

  return fullRows.map((row) => {
    const productVariants = variantsByProductId.get(row.product.id)
    const warrantyMonths = resolveProductWarrantyMonths({
      variants: row.product.variants,
      hasVariants: row.product.hasVariants,
      productVariants,
    })
    return serializeMarketplaceListing(row, { warrantyMonths })
  })
}

/** Buyer home SSR — capped listings, no variant blobs (keeps RSC under Next cache limits). */
export async function fetchMarketplaceListingsForHome(searchParams: URLSearchParams) {
  return fetchMarketplaceListings(searchParams, HOME_MARKETPLACE_LISTINGS_TAKE, { lite: true })
}
