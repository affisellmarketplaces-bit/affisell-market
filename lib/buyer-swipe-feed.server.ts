import "server-only"

import { unstable_cache } from "next/cache"

import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
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
    take: limit,
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
    const p = row.product
    const store = row.affiliate.store
    if (!store?.slug) continue

    const galleryUrls = [
      ...listingGalleryUrls(row.customImages ?? [], p.images ?? []),
      ...(p.videoAdUrl?.trim() ? [p.videoAdUrl.trim()] : []),
      ...p.videos.map((v) => v.videoUrl).filter(Boolean),
    ]
    const mediaGallery = buildPulseMediaGallery(galleryUrls)
    const primary = pickPulsePrimaryMedia(galleryUrls)
    const fallback =
      primary?.url ||
      primaryProductImage(p.images) ||
      listingGalleryUrls(row.customImages ?? [], p.images ?? [])[0] ||
      null
    if (!fallback) continue

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
      mediaUrl: fallback,
      isVideo: primary?.isVideo ?? false,
      mediaGallery: mediaGallery.length > 0 ? mediaGallery : undefined,
      likes: 0,
      views: 0,
      boosted: row.conversions > 0,
      href: `/shops/${encodeURIComponent(store.slug)}/product/${listingId}`,
    })
  }

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
