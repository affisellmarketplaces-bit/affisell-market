import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
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
} as const

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
  buyerRewardKind: true,
  buyerRewardPercent: true,
  showWarranty: true,
  product: {
    select: {
      id: true,
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
      deliveryMin: true,
      deliveryMax: true,
      processingTime: true,
      warehouseType: true,
      warehouseCity: true,
      shippingCountry: true,
      freeShippingThreshold: true,
      videoAdUrl: true,
      averageRating: true,
      reviewCount: true,
      reviewSentiment: true,
      ugcCount: true,
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
        },
      },
    },
  },
} as const

export type ListingDetailRow = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.affiliateProduct.findFirst<{ select: typeof listingDetailSelect }>
    >
  >
>

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
}) {
  const listingId = args.listingId.trim()

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: listingId,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: {
        role: "AFFILIATE",
        ...(args.storeSlug ? { store: { slug: args.storeSlug } } : {}),
      },
    },
    select: listingDetailSelect,
  })

  if (!listing?.product) return null

  const categories = Array.isArray(listing.product.categories)
    ? listing.product.categories.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []

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
    prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        id: { not: listing.id },
        product: {
          ...buyerMarketplaceProductWhere,
          ...(categories.length > 0 ? { categories: { hasSome: categories.slice(0, 3) } } : {}),
        },
      },
      select: RELATED_SELECT,
      take: 3,
    }),
    countViewsLast24h(listing.product.id),
    orderPromise,
  ])

  const fallbackRaw =
    oftenRaw.length >= 3
      ? []
      : await prisma.affiliateProduct.findMany({
          where: {
            ...buyerListedAffiliateProductWhere,
            id: { notIn: [listing.id, ...oftenRaw.map((r) => r.id)] },
          },
          orderBy: { createdAt: "desc" },
          select: RELATED_SELECT,
          take: 3,
        })

  return {
    listing,
    oftenRaw,
    fallbackRaw,
    viewsLast24h,
    writeReviewOrderId: orderRow?.id ?? null,
  }
}
