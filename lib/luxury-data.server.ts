import "server-only"

import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import {
  LUXURY_TIER_COLLECTION,
  LUXURY_TIER_LUXE,
  isLuxuryTierVisible,
} from "@/lib/luxury-constants"
import type { LuxuryAtelierPayload, LuxuryCollectionPublic, LuxuryPiecePublic } from "@/lib/luxury-types"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

function prestigeScore(priceCents: number, conversions: number, hasCompare: boolean): number {
  return Math.min(
    100,
    Math.round(priceCents / 500 + conversions * 5 + (hasCompare ? 12 : 0))
  )
}

export async function loadLuxuryAtelier(): Promise<LuxuryAtelierPayload> {
  const now = new Date()

  const collectionRows = await prisma.luxuryCollection.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      coverImageUrl: true,
      _count: {
        select: {
          listings: {
            where: {
              luxuryTier: LUXURY_TIER_COLLECTION,
              ...buyerListedAffiliateProductWhere,
              product: { isLuxury: true },
            },
          },
        },
      },
    },
  })

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      product: { ...buyerMarketplaceProductWhere, isLuxury: true },
    },
    orderBy: [{ sellingPriceCents: "desc" }, { conversions: "desc" }],
    take: 48,
    select: {
      id: true,
      productId: true,
      sellingPriceCents: true,
      conversions: true,
      customTitle: true,
      customImages: true,
      luxuryTier: true,
      luxuryCollectionId: true,
      luxuryCollection: { select: { id: true, name: true, slug: true } },
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          compareAt: true,
          isLuxury: true,
        },
      },
      affiliate: {
        select: {
          store: { select: { slug: true, name: true } },
        },
      },
    },
  })

  const pieces: LuxuryPiecePublic[] = []

  for (const row of listings) {
    if (!row.product.isLuxury) continue

    const displayTier =
      row.luxuryTier === LUXURY_TIER_COLLECTION && row.luxuryCollection
        ? LUXURY_TIER_COLLECTION
        : LUXURY_TIER_LUXE
    if (!isLuxuryTierVisible(displayTier)) continue

    const store = row.affiliate.store
    if (!store?.slug) continue

    const p = row.product
    const imageUrl =
      listingPrimaryImageUrl(row.customImages, p.images) ||
      primaryProductImage(p.images) ||
      "/placeholder-product.jpg"
    const compareRaw = p.compareAt != null ? Number(p.compareAt) : null
    const compareAtCents =
      compareRaw != null && Number.isFinite(compareRaw) && compareRaw * 100 > row.sellingPriceCents
        ? Math.round(compareRaw * 100)
        : null

    pieces.push({
      id: row.id,
      listingId: row.id,
      productId: p.id,
      title: listingDisplayTitle(row.customTitle, p.name),
      imageUrl,
      priceCents: row.sellingPriceCents,
      compareAtCents,
      storeSlug: store.slug,
      storeName: store.name,
      href: `/shops/${encodeURIComponent(store.slug)}/product/${row.id}`,
      tier: displayTier as LuxuryPiecePublic["tier"],
      collectionId:
        displayTier === LUXURY_TIER_COLLECTION ? (row.luxuryCollection?.id ?? null) : null,
      collectionName:
        displayTier === LUXURY_TIER_COLLECTION ? (row.luxuryCollection?.name ?? null) : null,
      prestigeScore: prestigeScore(row.sellingPriceCents, row.conversions, compareAtCents != null),
    })
  }

  pieces.sort((a, b) => b.prestigeScore - a.prestigeScore)

  const collections: LuxuryCollectionPublic[] = collectionRows
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      coverImageUrl: c.coverImageUrl,
      pieceCount: c._count.listings,
    }))
    .filter((c) => c.pieceCount > 0)

  const featuredListingId = pieces[0]?.listingId ?? null

  return {
    collections,
    pieces,
    featuredListingId,
    serverTime: now.toISOString(),
  }
}
