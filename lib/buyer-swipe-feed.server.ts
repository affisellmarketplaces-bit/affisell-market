import "server-only"

import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import { buildMarketplaceAffiliateWhereFromUrl } from "@/lib/marketplace-listings-query"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i

function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url.trim())
}

function pickMedia(urls: string[]): { mediaUrl: string | null; isVideo: boolean } {
  const cleaned = urls.filter((u) => typeof u === "string" && u.trim())
  const video = cleaned.find((u) => isVideoUrl(u))
  if (video) return { mediaUrl: video.trim(), isVideo: true }
  const first = cleaned[0]?.trim() || null
  if (!first) return { mediaUrl: null, isVideo: false }
  return { mediaUrl: first, isVideo: isVideoUrl(first) }
}

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

export async function loadBuyerSwipeFeedItems(
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
          videos: { take: 1, select: { videoUrl: true } },
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

    const gallery = [
      ...listingGalleryUrls(row.customImages ?? [], p.images ?? []),
      ...(p.videoAdUrl?.trim() ? [p.videoAdUrl.trim()] : []),
      ...(p.videos[0]?.videoUrl?.trim() ? [p.videos[0].videoUrl.trim()] : []),
    ]
    const { mediaUrl, isVideo } = pickMedia(gallery)
    const fallback =
      mediaUrl ||
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
      isVideo: isVideo || isVideoUrl(fallback),
      likes: 0,
      views: 0,
      boosted: row.conversions > 0,
      href: `/shops/${encodeURIComponent(store.slug)}/product/${listingId}`,
    })
  }

  return items
}
