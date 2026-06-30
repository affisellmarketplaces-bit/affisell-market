import { listingDisplayTitle, listingGalleryUrls, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import {
  buildPulseMediaGallery,
  pickPulsePrimaryMedia,
} from "@/lib/pulse-media-gallery"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

function pulseScore(opts: {
  likes: number
  views: number
  soldCount: number
  boosted: boolean
  createdAt: Date
}): number {
  const ageH = (Date.now() - opts.createdAt.getTime()) / 3_600_000
  const freshness = Math.max(0, 48 - ageH) / 48
  return (
    opts.likes * 4 +
    opts.views * 0.5 +
    opts.soldCount * 6 +
    (opts.boosted ? 12 : 0) +
    freshness * 8
  )
}

async function resolveBestListing(productId: string) {
  return prisma.affiliateProduct.findFirst({
    where: {
      productId,
      ...buyerListedAffiliateProductWhere,
      product: buyerMarketplaceProductWhere,
    },
    orderBy: [{ conversions: "desc" }, { id: "asc" }],
    select: {
      id: true,
      sellingPriceCents: true,
      conversions: true,
      customTitle: true,
      customImages: true,
      affiliate: {
        select: {
          store: {
            select: { slug: true, name: true, logoUrl: true, aiAvatarUrl: true },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          basePriceCents: true,
          compareAt: true,
          videoAdUrl: true,
        },
      },
    },
  })
}

export async function loadPulseFeedItems(opts?: {
  userId?: string | null
  limit?: number
}): Promise<PulseFeedItem[]> {
  const limit = Math.min(60, Math.max(8, opts?.limit ?? 36))
  const userId = opts?.userId ?? null

  const [history, communityRows, videoProducts] = await Promise.all([
    userId
      ? prisma.searchHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { productId: true, query: true },
        })
      : Promise.resolve([]),
    prisma.communityPost.findMany({
      where: {
        OR: [{ videoUrl: { not: null } }, { images: { isEmpty: false } }],
        store: { user: { role: { in: ["AFFILIATE", "SUPPLIER"] } } },
      },
      orderBy: [{ views: "desc" }, { likes: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        content: true,
        images: true,
        videoUrl: true,
        likes: true,
        views: true,
        createdAt: true,
        productId: true,
        store: {
          select: {
            slug: true,
            name: true,
            logoUrl: true,
            aiAvatarUrl: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        active: true,
        isDraft: false,
        OR: [{ videoAdUrl: { not: null } }, { videos: { some: {} } }],
        affiliateProducts: { some: buyerListedAffiliateProductWhere },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        images: true,
        basePriceCents: true,
        compareAt: true,
        videoAdUrl: true,
        createdAt: true,
        videos: { select: { videoUrl: true }, orderBy: { createdAt: "desc" } },
      },
    }),
  ])

  const touchedProductIds = new Set(
    history.map((h) => h.productId).filter(Boolean) as string[]
  )
  const queryWords = new Set(
    history
      .flatMap((h) => (h.query || "").toLowerCase().split(/\s+/))
      .map((w) => w.trim())
      .filter((w) => w.length >= 3)
  )

  const byKey = new Map<string, PulseFeedItem & { score: number }>()

  function upsert(item: PulseFeedItem, score: number) {
    const key = `${item.source}:${item.id}`
    const prev = byKey.get(key)
    if (!prev || score > prev.score) byKey.set(key, { ...item, score })
  }

  function itemWithGallery(
    base: Omit<PulseFeedItem, "mediaGallery">,
    galleryUrls: string[]
  ): PulseFeedItem {
    const mediaGallery = buildPulseMediaGallery(galleryUrls)
    return {
      ...base,
      mediaGallery: mediaGallery.length > 0 ? mediaGallery : undefined,
    }
  }

  for (const row of communityRows) {
    const urls = [
      ...(row.videoUrl?.trim() ? [row.videoUrl.trim()] : []),
      ...(row.images ?? []),
    ]
    const primary = pickPulsePrimaryMedia(urls)
    if (!primary) continue

    const listing = row.productId
      ? await resolveBestListing(row.productId)
      : null
    const p = listing?.product
    const store = row.store
    const boosted =
      (row.productId && touchedProductIds.has(row.productId)) ||
      (p && [...queryWords].some((w) => p.name.toLowerCase().includes(w)))

    const priceCents = listing?.sellingPriceCents ?? 0
    const compareRaw = p?.compareAt != null ? Number(p.compareAt) : null
    const compareAtCents =
      compareRaw != null && Number.isFinite(compareRaw) && compareRaw * 100 > priceCents
        ? Math.round(compareRaw * 100)
        : p && p.basePriceCents > priceCents
          ? p.basePriceCents
          : null

    const listingId = listing?.id ?? null
    const storeSlug = store.slug
    const title = listing
      ? listingDisplayTitle(listing.customTitle, p!.name)
      : row.content.slice(0, 120)

    upsert(
      itemWithGallery(
        {
          id: row.id,
          source: "community",
          productId: row.productId ?? p?.id ?? "",
          listingId,
          storeSlug,
          storeName: store.name,
          storeAvatarUrl: store.aiAvatarUrl || store.logoUrl,
          title,
          caption: row.content.slice(0, 280),
          priceCents,
          compareAtCents,
          soldCount: normalizeListingSalesCount(listing?.conversions),
          mediaUrl: primary.url,
          isVideo: primary.isVideo,
          likes: row.likes,
          views: row.views,
          boosted: Boolean(boosted),
          href: listingId
            ? storeSlug
              ? `/shops/${encodeURIComponent(storeSlug)}/product/${listingId}`
              : `/marketplace/${listingId}`
            : storeSlug
              ? `/store/${encodeURIComponent(storeSlug)}`
              : "/marketplace",
        },
        urls
      ),
      pulseScore({
        likes: row.likes,
        views: row.views,
        soldCount: listing?.conversions ?? 0,
        boosted: Boolean(boosted),
        createdAt: row.createdAt,
      })
    )
  }

  for (const prod of videoProducts) {
    const listing = await resolveBestListing(prod.id)
    if (!listing?.product) continue
    const p = listing.product
    const store = listing.affiliate.store
    const imageFallback = pickPulsePrimaryMedia(p.images ?? [])?.url
    const mediaCandidates = [
      prod.videoAdUrl?.trim(),
      ...prod.videos.map((v) => v.videoUrl),
      imageFallback,
    ].filter((u): u is string => Boolean(u))
    const primary = pickPulsePrimaryMedia(mediaCandidates)
    if (!primary?.isVideo) continue

    const boosted = touchedProductIds.has(prod.id) || [...queryWords].some((w) => p.name.toLowerCase().includes(w))
    const priceCents = listing.sellingPriceCents
    const compareRaw = p.compareAt != null ? Number(p.compareAt) : null
    const compareAtCents =
      compareRaw != null && Number.isFinite(compareRaw) && compareRaw * 100 > priceCents
        ? Math.round(compareRaw * 100)
        : p.basePriceCents > priceCents
          ? p.basePriceCents
          : null

    const listingId = listing.id
    const storeSlug = store?.slug ?? null

    upsert(
      itemWithGallery(
        {
          id: `product-${prod.id}`,
          source: "product",
          productId: prod.id,
          listingId,
          storeSlug,
          storeName: store?.name ?? null,
          storeAvatarUrl: store?.aiAvatarUrl || store?.logoUrl || null,
          title: listingDisplayTitle(listing.customTitle, p.name),
          caption: null,
          priceCents,
          compareAtCents,
          soldCount: normalizeListingSalesCount(listing.conversions),
          mediaUrl: primary.url,
          isVideo: true,
          likes: 0,
          views: 0,
          boosted: Boolean(boosted),
          href: storeSlug
            ? `/shops/${encodeURIComponent(storeSlug)}/product/${listingId}`
            : `/marketplace/${listingId}`,
        },
        mediaCandidates
      ),
      pulseScore({
        likes: 0,
        views: 0,
        soldCount: listing.conversions,
        boosted: Boolean(boosted),
        createdAt: prod.createdAt,
      })
    )
  }

  // Fallback: listed products with hero images when feed is thin
  if (byKey.size < 6) {
    const fallback = await prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        product: buyerMarketplaceProductWhere,
      },
      orderBy: [{ conversions: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        sellingPriceCents: true,
        conversions: true,
        customTitle: true,
        customImages: true,
        createdAt: true,
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
            store: { select: { slug: true, name: true, logoUrl: true, aiAvatarUrl: true } },
          },
        },
      },
    })

    for (const row of fallback) {
      const p = row.product
      const store = row.affiliate.store
      if (!store?.slug) continue
      const galleryUrls = [
        ...listingGalleryUrls(row.customImages ?? [], p.images ?? []),
        ...(p.videoAdUrl?.trim() ? [p.videoAdUrl.trim()] : []),
        ...p.videos.map((v) => v.videoUrl).filter(Boolean),
      ]
      const primary = pickPulsePrimaryMedia(galleryUrls)
      if (!primary) continue
      const key = `product-fallback-${row.id}`
      if ([...byKey.keys()].some((k) => k.includes(p.id))) continue

      const priceCents = row.sellingPriceCents
      const compareRaw = p.compareAt != null ? Number(p.compareAt) : null
      const compareAtCents =
        compareRaw != null && Number.isFinite(compareRaw) && compareRaw * 100 > priceCents
          ? Math.round(compareRaw * 100)
          : p.basePriceCents > priceCents
            ? p.basePriceCents
            : null

      upsert(
        itemWithGallery(
          {
            id: key,
            source: "product",
            productId: p.id,
            listingId: row.id,
            storeSlug: store.slug,
            storeName: store.name,
            storeAvatarUrl: store.aiAvatarUrl || store.logoUrl,
            title: listingDisplayTitle(row.customTitle, p.name),
            caption: null,
            priceCents,
            compareAtCents,
            soldCount: normalizeListingSalesCount(row.conversions),
            mediaUrl:
              primary.url ||
              listingPrimaryImageUrl(row.customImages, p.images) ||
              primaryProductImage(p.images) ||
              "/placeholder-product.jpg",
            isVideo: primary.isVideo,
            likes: 0,
            views: 0,
            boosted: touchedProductIds.has(p.id),
            href: `/shops/${encodeURIComponent(store.slug)}/product/${row.id}`,
          },
          galleryUrls
        ),
        pulseScore({
          likes: 0,
          views: 0,
          soldCount: row.conversions,
          boosted: touchedProductIds.has(p.id),
          createdAt: row.createdAt,
        })
      )
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...item }) => item)
}
