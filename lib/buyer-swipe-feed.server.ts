import "server-only"

import { unstable_cache } from "next/cache"

import {
  listingDisplayTitle,
  listingGalleryUrls,
  PRODUCT_CARD_IMAGE_FALLBACK,
} from "@/lib/affiliate-listing-display"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"
import { buildMarketplaceAffiliateWhereFromUrl } from "@/lib/marketplace-listings-query"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import {
  buildPulseMediaGallery,
  pickPulsePrimaryMedia,
} from "@/lib/pulse-media-gallery"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

const ANON_SWIPE_FEED_TAG = "buyer-swipe-feed-anon"

function compareAtCents(
  priceCents: number,
  basePriceCents: number,
  compareAt: unknown
): number | null {
  const compareRaw = compareAt != null ? Number(compareAt) : null
  if (compareRaw != null && Number.isFinite(compareRaw) && compareRaw * 100 > priceCents) {
    return Math.round(compareRaw * 100)
  }
  if (basePriceCents > priceCents) return basePriceCents
  return null
}

function isDefaultSwipeFeedQuery(searchParams: URLSearchParams): boolean {
  return (
    !searchParams.get("category")?.trim() &&
    !searchParams.get("subcategory")?.trim() &&
    !searchParams.get("q")?.trim()
  )
}

async function loadBuyerSwipeFeedItemsUncached(
  searchParams: URLSearchParams,
  opts?: { limit?: number }
): Promise<PulseFeedItem[]> {
  const limit = Math.min(48, Math.max(6, opts?.limit ?? 24))
  // Over-fetch so listings skipped for missing store still leave a full deck.
  const take = Math.min(80, limit * 2)
  const where = await buildMarketplaceAffiliateWhereFromUrl(searchParams)

  const rows = await prisma.affiliateProduct.findMany({
    where: {
      AND: [where, { affiliate: { store: { isNot: null } } }],
    },
    orderBy: [
      { isFeatured: "desc" },
      { conversions: "desc" },
      { clicks: "desc" },
      { createdAt: "desc" },
    ],
    take,
    select: {
      id: true,
      sellingPriceCents: true,
      conversions: true,
      customTitle: true,
      customImages: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          basePriceCents: true,
          compareAt: true,
          videoAdUrl: true,
          videos: { select: { videoUrl: true }, orderBy: { createdAt: "desc" } },
        },
      },
      affiliate: {
        select: {
          store: {
            select: { slug: true, name: true, logoUrl: true, aiAvatarUrl: true },
          },
        },
      },
    },
  })

  const items: PulseFeedItem[] = []

  for (const row of rows) {
    if (items.length >= limit) break
    const p = row.product
    const store = row.affiliate.store
    if (!store?.slug) continue

    const imageUrls = listingGalleryUrls(row.customImages ?? [], p.images ?? [])
    const videoUrls = [
      ...(p.videoAdUrl?.trim() ? [p.videoAdUrl.trim()] : []),
      ...p.videos.map((v) => v.videoUrl).filter(Boolean),
    ]
    const remoteImage =
      primaryProductImage(p.images) || imageUrls[0] || null
    const cardHref = resolveListingCardImageHref(remoteImage, row.id)
    const galleryUrls = [cardHref, ...imageUrls, ...videoUrls]
    const mediaGallery = buildPulseMediaGallery(galleryUrls)
    // Prefer photo cover so misclassified / broken videos don't black-out the card.
    const primary = pickPulsePrimaryMedia(galleryUrls, { preferImage: true })
    const mediaUrl = primary?.url || cardHref || PRODUCT_CARD_IMAGE_FALLBACK
    const isVideo = Boolean(primary?.isVideo)

    const priceCents = row.sellingPriceCents
    const listingId = row.id

    items.push({
      id: listingId,
      source: "product",
      productId: p.id,
      listingId,
      storeSlug: store.slug,
      storeName: store.name,
      storeAvatarUrl: store.aiAvatarUrl || store.logoUrl,
      title: listingDisplayTitle(row.customTitle, p.name),
      caption: null,
      priceCents,
      compareAtCents: compareAtCents(priceCents, p.basePriceCents, p.compareAt),
      soldCount: normalizeListingSalesCount(row.conversions),
      mediaUrl,
      isVideo,
      mediaGallery:
        mediaGallery.length > 0
          ? mediaGallery
          : [{ url: mediaUrl, isVideo: false }],
      likes: 0,
      views: 0,
      boosted: row.conversions > 0,
      href: `/shops/${encodeURIComponent(store.slug)}/product/${listingId}`,
    })
  }

  console.log("[buyer-swipe-feed]", {
    result: "ok",
    requested: limit,
    returned: items.length,
    scanned: rows.length,
  })

  return items
}

const loadAnonymousSwipeFeedCached = unstable_cache(
  async (limit: number) => loadBuyerSwipeFeedItemsUncached(new URLSearchParams(), { limit }),
  ["buyer-swipe-feed-anon"],
  { revalidate: 60, tags: [ANON_SWIPE_FEED_TAG] }
)

export async function loadBuyerSwipeFeedItems(
  searchParams: URLSearchParams,
  opts?: { limit?: number }
): Promise<PulseFeedItem[]> {
  const limit = Math.min(48, Math.max(6, opts?.limit ?? 24))
  if (isDefaultSwipeFeedQuery(searchParams) && limit === 24) {
    return loadAnonymousSwipeFeedCached(limit)
  }
  return loadBuyerSwipeFeedItemsUncached(searchParams, opts)
}
