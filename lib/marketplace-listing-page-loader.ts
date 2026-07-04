import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"

const RELATED_SELECT = {
  id: true,
  sellingPriceCents: true,
  conversions: true,
  customTitle: true,
  customImages: true,
  product: {
    select: {
      name: true,
      images: true,
    },
  },
  affiliate: {
    select: {
      store: { select: { slug: true } },
    },
  },
} as const

/** PDP select — omits `supplierTrustTier` so DBs without migration still load. */
export const listingDetailSelect = {
  id: true,
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
  const listingId = args.listingId.trim()

  const baseAffiliateWhere = { role: "AFFILIATE" as const }
  const scopedAffiliateWhere = {
    ...baseAffiliateWhere,
    ...(args.storeSlug ? { store: { slug: args.storeSlug } } : {}),
  }

  let listing = await findListingDetailRow({
    id: listingId,
    isListed: true,
    product: buyerMarketplaceProductWhere,
    affiliate: scopedAffiliateWhere,
  })

  let listingIdRedirect: string | null = null
  if (!listing) {
    listing = await findListingDetailRow({
      productId: listingId,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
    if (listing && listing.id !== listingId) {
      listingIdRedirect = listing.id
    }
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
        id: listingId,
        isListed: false,
        product: buyerMarketplaceProductWhere,
        affiliate: ownerAffiliateWhere,
      })) ??
      (await findListingDetailRow({
        productId: listingId,
        isListed: false,
        product: buyerMarketplaceProductWhere,
        affiliate: ownerAffiliateWhere,
      }))
    if (listing) {
      ownerPreviewUnlisted = true
      if (listing.id !== listingId) {
        listingIdRedirect = listing.id
      }
    }
  }

  let canonicalRedirect: string | null = null
  if (!listing && args.storeSlug) {
    listing = await findListingDetailRow({
      id: listingId,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: baseAffiliateWhere,
    })
    if (!listing) {
      listing = await findListingDetailRow({
        productId: listingId,
        isListed: true,
        product: buyerMarketplaceProductWhere,
        affiliate: baseAffiliateWhere,
      })
      if (listing && listing.id !== listingId) {
        listingIdRedirect = listing.id
      }
    }
    const canonicalSlug = listing?.affiliate.store?.slug?.trim()
    if (canonicalSlug && canonicalSlug !== args.storeSlug) {
      canonicalRedirect = canonicalSlug
    }
  }

  if (!listing?.product) return null

  const categories = Array.isArray(listing.product.categories)
    ? listing.product.categories.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []

  const storeSlugForRelated = args.storeSlug?.trim() || listing.affiliate.store?.slug?.trim() || null
  const shouldLoadRelated = Boolean(storeSlugForRelated) || categories.length > 0

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

  const [oftenRaw, viewsLast24h, orderRow] = await Promise.all([
    shouldLoadRelated
      ? prisma.affiliateProduct.findMany({
          where: {
            ...buyerListedAffiliateProductWhere,
            id: { not: listing.id },
            ...(storeSlugForRelated
              ? { affiliate: { store: { slug: storeSlugForRelated } } }
              : {}),
            product: {
              ...buyerMarketplaceProductWhere,
              ...(categories.length > 0 ? { categories: { hasSome: categories.slice(0, 3) } } : {}),
            },
          },
          select: RELATED_SELECT,
          take: 3,
        })
      : Promise.resolve([]),
    countViewsLast24h(listing.product.id),
    orderPromise,
  ])

  const fallbackRaw =
    !shouldLoadRelated || oftenRaw.length >= 3
      ? []
      : await prisma.affiliateProduct.findMany({
          where: {
            ...buyerListedAffiliateProductWhere,
            id: { notIn: [listing.id, ...oftenRaw.map((r) => r.id)] },
            ...(storeSlugForRelated
              ? { affiliate: { store: { slug: storeSlugForRelated } } }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          select: RELATED_SELECT,
          take: 3,
        })

  return {
    listing,
    canonicalRedirect,
    listingIdRedirect,
    ownerPreviewUnlisted,
    oftenRaw,
    fallbackRaw,
    viewsLast24h,
    writeReviewOrderId: orderRow?.id ?? null,
  }
}
