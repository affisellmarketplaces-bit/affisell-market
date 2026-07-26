import { unstable_cache } from "next/cache"

import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { looksLikeAffiliateListingId } from "@/lib/listing-public-url-shared"
import { loadListingSocialProofCached } from "@/lib/marketplace-listing-social-proof"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"
import { shopTag } from "@/lib/shop-storefront-cache"

const LISTING_REVALIDATE_SEC = 60

/** PDP select — trust tier inlined when column exists (fallback query without it). */
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
      lastStockCheck: true,
      lastStockStatus: true,
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

const listingDetailSelectWithTrust = {
  ...listingDetailSelect,
  product: {
    select: {
      ...listingDetailSelect.product.select,
      supplier: {
        select: {
          name: true,
          isVerifiedSupplier: true,
          supplierTrustTier: true,
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

function withTrustTier(
  row: ListingDetailRowBase,
  supplierTrustTier: string
): ListingDetailRow {
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

async function findListingDetailRow(where: ListingWhere): Promise<ListingDetailRow | null> {
  const whereClause = {
    ...(where.id ? { id: where.id } : {}),
    ...(where.productId ? { productId: where.productId } : {}),
    ...(where.customSlug ? { customSlug: where.customSlug } : {}),
    ...(where.isListed !== undefined ? { isListed: where.isListed } : {}),
    product: where.product,
    affiliate: where.affiliate,
  }

  try {
    const row = await prisma.affiliateProduct.findFirst({
      where: whereClause,
      select: listingDetailSelectWithTrust,
    })
    if (!row?.product) return null
    const tier =
      "supplierTrustTier" in row.product.supplier &&
      typeof row.product.supplier.supplierTrustTier === "string"
        ? row.product.supplier.supplierTrustTier
        : "NONE"
    return withTrustTier(row as ListingDetailRowBase, tier)
  } catch (error: unknown) {
    if (!isPrismaMissingColumnError(error, "supplierTrustTier")) throw error
  }

  const row = await prisma.affiliateProduct.findFirst({
    where: whereClause,
    select: listingDetailSelect,
  })
  if (!row?.product) return null
  return withTrustTier(row, "NONE")
}

type PublicListingResolve = {
  listing: ListingDetailRow | null
  canonicalRedirect: string | null
  listingIdRedirect: string | null
}

async function resolvePublicListedListing(
  segment: string,
  storeSlug: string | undefined
): Promise<PublicListingResolve> {
  const baseAffiliateWhere = { role: "AFFILIATE" as const }
  const scopedAffiliateWhere = {
    ...baseAffiliateWhere,
    ...(storeSlug ? { store: { slug: storeSlug } } : {}),
  }

  let listing = looksLikeAffiliateListingId(segment)
    ? await findListingDetailRow({
        id: segment,
        isListed: true,
        product: buyerMarketplaceProductWhere,
        affiliate: scopedAffiliateWhere,
      })
    : null

  if (!listing && storeSlug) {
    listing = await findListingDetailRow({
      customSlug: segment,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
  }

  // Non-cuid segments (and cuid misses without store scope): try id once if not already tried.
  if (!listing && !looksLikeAffiliateListingId(segment)) {
    listing = await findListingDetailRow({
      id: segment,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: scopedAffiliateWhere,
    })
  }

  let listingIdRedirect: string | null = null

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

  let canonicalRedirect: string | null = null
  if (!listing && storeSlug) {
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
    if (canonicalSlug && canonicalSlug !== storeSlug) {
      canonicalRedirect = canonicalSlug
    }
  }

  return { listing, canonicalRedirect, listingIdRedirect }
}

function loadPublicListedListingCached(
  segment: string,
  storeSlug: string | undefined
): Promise<PublicListingResolve> {
  const key = segment.trim().toLowerCase()
  const scope = (storeSlug ?? "").trim().toLowerCase()
  const tags = [`listing-${key}`]
  if (scope) tags.push(shopTag(scope))

  return unstable_cache(
    () => resolvePublicListedListing(segment, storeSlug),
    ["marketplace-listing-detail", key, scope],
    { revalidate: LISTING_REVALIDATE_SEC, tags }
  )()
}

async function resolveOwnerPreviewListing(
  segment: string,
  storeSlug: string | undefined,
  ownerAffiliateUserId: string
): Promise<{ listing: ListingDetailRow | null; listingIdRedirect: string | null }> {
  const ownerAffiliateWhere = {
    role: "AFFILIATE" as const,
    id: ownerAffiliateUserId,
    ...(storeSlug ? { store: { slug: storeSlug } } : {}),
  }
  const listing =
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

  const listingIdRedirect = listing && listing.id !== segment ? listing.id : null
  return { listing, listingIdRedirect }
}

async function loadMarketplaceListingPageDataUncached(args: {
  listingId: string
  storeSlug?: string
  buyerUserId?: string | null
  orderId?: string | null
  /** Signed-in affiliate owner previewing their own hidden listing (`?preview=affiliate`). */
  allowOwnerPreview?: boolean
  ownerAffiliateUserId?: string | null
}) {
  const segment = args.listingId.trim()

  const publicResolve = await loadPublicListedListingCached(segment, args.storeSlug)
  let listing = publicResolve.listing
  const canonicalRedirect = publicResolve.canonicalRedirect
  let listingIdRedirect = publicResolve.listingIdRedirect

  let ownerPreviewUnlisted = false
  if (!listing && args.allowOwnerPreview && args.ownerAffiliateUserId) {
    const preview = await resolveOwnerPreviewListing(
      segment,
      args.storeSlug,
      args.ownerAffiliateUserId
    )
    listing = preview.listing
    if (preview.listingIdRedirect) listingIdRedirect = preview.listingIdRedirect
    if (listing) ownerPreviewUnlisted = true
  }

  if (!listing?.product) return null

  // Soft canonical only (metadata) — hard id→customSlug redirect doubled TTFB on CUID URLs.
  const listingSlugRedirect: string | null = null

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

  const [social, orderRow] = await Promise.all([
    loadListingSocialProofCached(listing.product.id),
    orderPromise,
  ])

  return {
    listing,
    canonicalRedirect,
    listingIdRedirect,
    listingSlugRedirect,
    ownerPreviewUnlisted,
    viewsLast24h: social.viewsLast24h,
    affiliateCreatorsWatching: social.affiliateCreatorsWatching,
    writeReviewOrderId: orderRow?.id ?? null,
  }
}

/** Cross-request cached public listing shell (+ optional owner preview / write-review). */
export async function loadMarketplaceListingPageData(args: {
  listingId: string
  storeSlug?: string
  buyerUserId?: string | null
  orderId?: string | null
  /** Signed-in affiliate owner previewing their own hidden listing (`?preview=affiliate`). */
  allowOwnerPreview?: boolean
  ownerAffiliateUserId?: string | null
}) {
  return loadMarketplaceListingPageDataUncached(args)
}
