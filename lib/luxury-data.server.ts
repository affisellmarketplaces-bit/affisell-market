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

/** Dev/demo bootstrap only when no supplier-flagged luxury products exist. */
async function seedLuxuryShowcaseIfEmpty(): Promise<void> {
  const visible = await prisma.product.count({
    where: {
      isLuxury: true,
      ...buyerMarketplaceProductWhere,
      affiliateProducts: { some: buyerListedAffiliateProductWhere },
    },
  })
  if (visible > 0) return

  await ensureLuxuryCollections()

  const candidates = await prisma.product.findMany({
    where: {
      ...buyerMarketplaceProductWhere,
      isLuxury: false,
      affiliateProducts: { some: buyerListedAffiliateProductWhere },
    },
    orderBy: [{ basePriceCents: "desc" }, { createdAt: "desc" }],
    take: 9,
    select: { id: true },
  })

  if (candidates.length === 0) return

  const productIds = candidates.map((c) => c.id)
  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { isLuxury: true },
  })

  console.log("[luxe]", { result: "seeded", products: productIds.length })
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
