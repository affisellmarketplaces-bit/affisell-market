import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { looksLikeAffiliateListingId } from "@/lib/listing-public-url-shared"
import { countAffiliateCreatorsWatchingProduct } from "@/lib/affiliate-product-opportunity-pulse"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"

/** PDP select — omits `supplierTrustTier` so DBs without migration still load. */
export const listingDetailSelect = {
  id: true,
  affiliateId: true,
  sellingPriceCents: true,
  conversions: true,
  customTitle: true,
  customImages: true,
  customDescription: true,
  promotedColor: true,
  promotedSize: true,
  promotedVariantKeys: true,
  variantPricing: true,
  buyerRewardKind: true,
  buyerRewardPercent: true,
  showWarranty: true,
  customSlug: true,
  product: {
    select: {
      id: true,
      supplierId: true,
      name: true,
      description: true,
      descriptionBullets: true,
      descriptionIllustrationImages: true,
      descriptionIllustrationVideos: true,
      images: true,
      categories: true,
      colors: true,
      tags: true,
      variants: true,
      colorImages: true,
      customColumns: true,
      hasVariants: true,
      compareAt: true,
      basePriceCents: true,
      stock: true,
      listingKind: true,
      deliveryMin: true,
      deliveryMax: true,
      processingTime: true,
      warehouseType: true,
      warehouseCity: true,
      shippingCountry: true,
      deliveryCountryCodes: true,
      shipsFrom: true,
      freeShippingThreshold: true,
      videoAdUrl: true,
      videos: { select: { videoUrl: true }, take: 1 },
      offerMode: true,
      minOrderQuantity: true,
      averageRating: true,
      reviewCount: true,
      reviewSentiment: true,
      ugcCount: true,
      tryOnEnabled: true,
      tryOnGarmentUrl: true,
      attributes: {
        orderBy: { label: "asc" as const },
        select: { label: true, key: true, value: true },
      },
      productVariants: {
        select: {
          id: true,
          color: true,
          size: true,
          stock: true,
          supplierPrice: true,
          customData: true,
        },
      },
      supplier: {
        select: {
          name: true,
          isVerifiedSupplier: true,
        },
      },
    },
  },
  affiliate: {
    select: {
      name: true,
      store: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          aiAvatarUrl: true,
          customDomain: true,
          domainVerified: true,
          storefrontTheme: true,
        },
      },
    },
  },
} as const

type ListingWhere = {
  id?: string
  productId?: string
  customSlug?: string
  isListed?: boolean
  product: typeof buyerMarketplaceProductWhere
  affiliate: {
    role: string
    id?: string
    store?: { slug: string }
  }
}

type ListingDetailRowBase = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.affiliateProduct.findFirst<{ select: typeof listingDetailSelect }>
    >
  >
>

export type ListingDetailRow = ListingDetailRowBase & {
  product: ListingDetailRowBase["product"] & {
    supplier: ListingDetailRowBase["product"]["supplier"] & {
      supplierTrustTier: string
    }
  }
}

async function loadSupplierTrustTier(supplierId: string): Promise<string> {
  try {
    const row = await prisma.user.findUnique({
      where: { id: supplierId },
      select: { supplierTrustTier: true },
    })
    return row?.supplierTrustTier ?? "NONE"
  } catch (error: unknown) {
    if (isPrismaMissingColumnError(error, "supplierTrustTier")) {
      return "NONE"
    }
    throw error
  }
}

async function findListingDetailRow(where: ListingWhere): Promise<ListingDetailRow | null> {
  const row = await prisma.affiliateProduct.findFirst({
    where: {
      ...(where.id ? { id: where.id } : {}),
      ...(where.productId ? { productId: where.productId } : {}),
      ...(where.customSlug ? { customSlug: where.customSlug } : {}),
      ...(where.isListed !== undefined ? { isListed: where.isListed } : {}),
      product: where.product,
      affiliate: where.affiliate,
    },
    select: listingDetailSelect,
  })
  if (!row?.product) return null

  const supplierTrustTier = await loadSupplierTrustTier(row.product.supplierId)

  return {
    ...row,
    product: {
      ...row.product,
      supplier: {
        ...row.product.supplier,
        supplierTrustTier,
      },
    },
  } as ListingDetailRow
}

async function countViewsLast24h(productId: string): Promise<number> {
  try {
    const since = new Date()
    since.setUTCMinutes(since.getUTCMinutes() - 24 * 60)
    return await prisma.affisellTrackEvent.count({
      where: {
        eventType: "view",
        productId,
        createdAt: { gte: since },
      },
    })
  } catch {
    return 0
  }
}

export async function loadMarketplaceListingPageData(args: {
  listingId: string
  storeSlug?: string
  buyerUserId?: string | null
  orderId?: string | null
  /** Signed-in affiliate owner previewing their own hidden listing (`?preview=affiliate`). */
  allowOwnerPreview?: boolean
  ownerAffiliateUserId?: string | null
}) {
  const segment = args.listingId.trim()

  const baseAffiliateWhere = { role: "AFFILIATE" as const }
  const scopedAffiliateWhere = {
    ...baseAffiliateWhere,
    ...(args.storeSlug ? { store: { slug: args.storeSlug } } : {}),
  }

  let listing = looksLikeAffiliateListingId(segment)
    ? await findListingDetailRow({
        id: segment,
        isListed: true,
        product: buyerMarketplaceProductWhere,
        affiliate: scopedAffiliateWhere,
      })
    : null

  if (!listing && args.storeSlug) {
    listing = await findListingDetailRow({
      customSlug: segment,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
  }

  let listingIdRedirect: string | null = null
  let listingSlugRedirect: string | null = null

  if (!listing) {
    listing = await findListingDetailRow({
      id: segment,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
  }

  if (!listing) {
    listing = await findListingDetailRow({
      productId: segment,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
    if (listing && listing.id !== segment) {
      listingIdRedirect = listing.id
    }
  }

  if (listing?.customSlug?.trim() && segment === listing.id) {
    listingSlugRedirect = listing.customSlug.trim()
  }

  let ownerPreviewUnlisted = false
  if (!listing && args.allowOwnerPreview && args.ownerAffiliateUserId) {
    const ownerAffiliateWhere = {
      ...baseAffiliateWhere,
      id: args.ownerAffiliateUserId,
      ...(args.storeSlug ? { store: { slug: args.storeSlug } } : {}),
    }
    listing =
      (await findListingDetailRow({
        id: segment,
        isListed: false,
        product: buyerMarketplaceProductWhere,
        affiliate: ownerAffiliateWhere,
      })) ??
      (await findListingDetailRow({
        customSlug: segment,
        isListed: false,
        product: buyerMarketplaceProductWhere,
        affiliate: ownerAffiliateWhere,
      })) ??
      (await findListingDetailRow({
        productId: segment,
        isListed: false,
        product: buyerMarketplaceProductWhere,
        affiliate: ownerAffiliateWhere,
      }))
    if (listing) {
      ownerPreviewUnlisted = true
      if (listing.id !== segment) {
        listingIdRedirect = listing.id
      }
    }
  }

  let canonicalRedirect: string | null = null
  if (!listing && args.storeSlug) {
    listing = looksLikeAffiliateListingId(segment)
      ? await findListingDetailRow({
          id: segment,
          isListed: true,
          product: buyerMarketplaceProductWhere,
          affiliate: baseAffiliateWhere,
        })
      : await findListingDetailRow({
          customSlug: segment,
          isListed: true,
          product: buyerMarketplaceProductWhere,
          affiliate: baseAffiliateWhere,
        })
    if (!listing) {
      listing = await findListingDetailRow({
        productId: segment,
        isListed: true,
        product: buyerMarketplaceProductWhere,
        affiliate: baseAffiliateWhere,
      })
      if (listing && listing.id !== segment) {
        listingIdRedirect = listing.id
      }
    }
    const canonicalSlug = listing?.affiliate.store?.slug?.trim()
    if (canonicalSlug && canonicalSlug !== args.storeSlug) {
      canonicalRedirect = canonicalSlug
    }
  }

  if (!listing?.product) return null

  if (!listingSlugRedirect && listing.customSlug?.trim() && segment === listing.id) {
    listingSlugRedirect = listing.customSlug.trim()
  }

  const orderPromise =
    args.buyerUserId && args.orderId?.trim()
      ? prisma.order.findFirst({
          where: {
            id: args.orderId.trim(),
            buyerUserId: args.buyerUserId,
            productId: listing.product.id,
            deliveredAt: { not: null },
            buyerReview: null,
          },
          select: { id: true },
        })
      : Promise.resolve(null)

  const [viewsLast24h, affiliateCreatorsWatching, orderRow] = await Promise.all([
    countViewsLast24h(listing.product.id),
    countAffiliateCreatorsWatchingProduct(listing.product.id),
    orderPromise,
  ])

  return {
    listing,
    canonicalRedirect,
    listingIdRedirect,
    listingSlugRedirect,
    ownerPreviewUnlisted,
    viewsLast24h,
    affiliateCreatorsWatching,
    writeReviewOrderId: orderRow?.id ?? null,
  }
}
