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

const DEFAULT_COLLECTIONS = [
  {
    slug: "maison-affisell",
    name: "Maison Affisell",
    tagline: "Signatures curatoriales",
    sortOrder: 0,
  },
  {
    slug: "noir-or",
    name: "Noir & Or",
    tagline: "Contrastes précieux",
    sortOrder: 1,
  },
  {
    slug: "voyage-sensoriel",
    name: "Voyage sensoriel",
    tagline: "Évasion contemporaine",
    sortOrder: 2,
  },
] as const

function prestigeScore(priceCents: number, conversions: number, hasCompare: boolean): number {
  return Math.min(
    100,
    Math.round(priceCents / 500 + conversions * 5 + (hasCompare ? 12 : 0))
  )
}

async function ensureLuxuryCollections(): Promise<void> {
  for (const c of DEFAULT_COLLECTIONS) {
    await prisma.luxuryCollection.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        sortOrder: c.sortOrder,
        active: true,
      },
      update: { name: c.name, tagline: c.tagline, active: true },
    })
  }
}

/** Dev/demo bootstrap only when no curated luxury listings exist. */
async function seedLuxuryShowcaseIfEmpty(): Promise<void> {
  const visible = await prisma.affiliateProduct.count({
    where: {
      luxuryTier: { in: [LUXURY_TIER_LUXE, LUXURY_TIER_COLLECTION] },
      ...buyerListedAffiliateProductWhere,
    },
  })
  if (visible > 0) return

  await ensureLuxuryCollections()
  const collections = await prisma.luxuryCollection.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true },
  })
  const maison = collections.find((c) => c.slug === "maison-affisell") ?? collections[0]
  if (!maison) return

  const candidates = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      product: buyerMarketplaceProductWhere,
      luxuryTier: "NONE",
    },
    orderBy: [{ sellingPriceCents: "desc" }, { conversions: "desc" }],
    take: 12,
    select: { id: true },
  })

  if (candidates.length === 0) return

  const luxeIds = candidates.slice(0, 3).map((c) => c.id)
  const collectionIds = candidates.slice(3, 9).map((c) => c.id)

  if (luxeIds.length > 0) {
    await prisma.affiliateProduct.updateMany({
      where: { id: { in: luxeIds } },
      data: { luxuryTier: LUXURY_TIER_LUXE, luxuryCollectionId: null },
    })
  }
  if (collectionIds.length > 0) {
    await prisma.affiliateProduct.updateMany({
      where: { id: { in: collectionIds } },
      data: { luxuryTier: LUXURY_TIER_COLLECTION, luxuryCollectionId: maison.id },
    })
  }

  console.log("[luxe]", {
    result: "seeded",
    luxe: luxeIds.length,
    collection: collectionIds.length,
    collectionSlug: maison.slug,
  })
}

export async function loadLuxuryAtelier(): Promise<LuxuryAtelierPayload> {
  await ensureLuxuryCollections()
  await seedLuxuryShowcaseIfEmpty()

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
            },
          },
        },
      },
    },
  })

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      product: buyerMarketplaceProductWhere,
      OR: [
        { luxuryTier: LUXURY_TIER_LUXE },
        {
          luxuryTier: LUXURY_TIER_COLLECTION,
          luxuryCollection: { active: true },
        },
      ],
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
    if (!isLuxuryTierVisible(row.luxuryTier)) continue
    if (row.luxuryTier === LUXURY_TIER_COLLECTION && !row.luxuryCollection) continue

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
      tier: row.luxuryTier as LuxuryPiecePublic["tier"],
      collectionId: row.luxuryCollection?.id ?? null,
      collectionName: row.luxuryCollection?.name ?? null,
      prestigeScore: prestigeScore(row.sellingPriceCents, row.conversions, compareAtCents != null),
    })
  }

  pieces.sort((a, b) => b.prestigeScore - a.prestigeScore)

  const collections: LuxuryCollectionPublic[] = collectionRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    coverImageUrl: c.coverImageUrl,
    pieceCount: c._count.listings,
  }))

  const featuredListingId = pieces[0]?.listingId ?? null

  return {
    collections,
    pieces,
    featuredListingId,
    serverTime: now.toISOString(),
  }
}
