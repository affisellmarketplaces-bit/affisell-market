import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import {
  type BuyerCategoryChip,
  type BuyerListingCard,
} from "@/lib/buyer-discovery-types"
import { loadHomeBestSellers7d, loadHomeNewArrivals } from "@/lib/home-marketplace-data"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import { inferNicheLabel } from "@/lib/shop-storefront-shared"

export type { BuyerCategoryChip, BuyerListingCard } from "@/lib/buyer-discovery-types"
export { buyerListingToCardProps } from "@/lib/buyer-discovery-types"

const listingSelect = {
  id: true,
  sellingPriceCents: true,
  conversions: true,
  productId: true,
  customTitle: true,
  customImages: true,
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      categories: true,
      deliveryMin: true,
      deliveryMax: true,
      deliveryDays: true,
      isBestSeller: true,
      freeShipping: true,
      stock: true,
      averageRating: true,
      reviewCount: true,
    },
  },
  affiliate: {
    select: {
      store: { select: { slug: true, name: true, description: true } },
    },
  },
} as const

function mapRow(
  row: {
    id: string
    sellingPriceCents: number
    productId: string
    customTitle: string | null
    customImages: string[]
    product: {
      id: string
      name: string
      images: string[]
      basePriceCents: number
      categories: string[]
      deliveryMin: number
      deliveryMax: number
      deliveryDays: number | null
      isBestSeller: boolean
      freeShipping: boolean
      stock: number
      averageRating: number
      reviewCount: number
    }
    affiliate: {
      store: { slug: string; name: string; description: string | null } | null
    }
  },
  soldCount = 0
): BuyerListingCard | null {
  const store = row.affiliate.store
  if (!store?.slug) return null
  const p = row.product
  const name = listingDisplayTitle(row.customTitle, p.name)
  const imageUrl =
    listingPrimaryImageUrl(row.customImages, p.images) || primaryProductImage(p.images) || null
  const deliveryMin = p.deliveryMin ?? 2
  const deliveryMax = p.deliveryMax ?? p.deliveryDays ?? 7

  return {
    listingId: row.id,
    productId: p.id,
    name,
    imageUrl,
    priceCents: row.sellingPriceCents,
    compareAtCents: p.basePriceCents > row.sellingPriceCents ? p.basePriceCents : null,
    soldCount,
    marginCents: 0,
    deliveryMin,
    deliveryMax,
    stock: p.stock,
    freeShipping: p.freeShipping,
    commissionPct: 0,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    storeName: store.name,
    storeSlug: store.slug,
    nicheLabel: inferNicheLabel(store.description, store.name),
    categories: p.categories ?? [],
    isBestSeller: p.isBestSeller,
  }
}

/** Live affiliate storefront listings — what buyers can actually purchase. */
export async function loadBuyerListedProducts(limit = 48): Promise<BuyerListingCard[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      affiliate: { store: { isNot: null } },
    },
    select: listingSelect,
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    take: Math.min(limit * 2, 120),
  })

  const seen = new Set<string>()
  const cards: BuyerListingCard[] = []
  for (const row of listings) {
    if (seen.has(row.productId)) continue
    seen.add(row.productId)
    const card = mapRow(row, normalizeListingSalesCount(row.conversions))
    if (card) cards.push(card)
    if (cards.length >= limit) break
  }
  return cards
}

export async function loadBuyerListingsByListingIds(
  listingIds: string[],
  excludeProductIds: string[],
  limit = 8
): Promise<BuyerListingCard[]> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  const exclude = new Set(excludeProductIds.map((id) => id.trim()).filter(Boolean))
  if (ids.length === 0) return []

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      id: { in: ids },
      ...buyerListedAffiliateProductWhere,
      affiliate: { store: { isNot: null } },
      product: exclude.size > 0 ? { id: { notIn: [...exclude] } } : undefined,
    },
    select: listingSelect,
  })

  const byId = new Map(listings.map((row) => [row.id, row]))
  const cards: BuyerListingCard[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row || exclude.has(row.productId)) continue
    const card = mapRow(row, normalizeListingSalesCount(row.conversions))
    if (card) cards.push(card)
    if (cards.length >= limit) break
  }
  return cards
}

/** Personalized catalog — same categories as wishlist / orders / browse signals. */
export async function loadBuyerListingsByCategoryHints(
  categoryHints: string[],
  excludeProductIds: string[],
  limit = 8
): Promise<BuyerListingCard[]> {
  const hints = [...new Set(categoryHints.map((c) => c.trim()).filter(Boolean))].slice(0, 8)
  if (hints.length === 0) return []

  const exclude = [...new Set(excludeProductIds.map((id) => id.trim()).filter(Boolean))]

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      affiliate: { store: { isNot: null } },
      product: {
        id: exclude.length > 0 ? { notIn: exclude } : undefined,
        categories: { hasSome: hints },
      },
    },
    select: listingSelect,
    orderBy: [{ conversions: "desc" }, { updatedAt: "desc" }],
    take: Math.min(limit * 3, 48),
  })

  const seen = new Set<string>()
  const cards: BuyerListingCard[] = []
  for (const row of listings) {
    if (seen.has(row.productId)) continue
    seen.add(row.productId)
    const card = mapRow(row, normalizeListingSalesCount(row.conversions))
    if (card) cards.push(card)
    if (cards.length >= limit) break
  }

  return cards
}

export async function loadBuyerListedProductsSafe(limit = 48): Promise<BuyerListingCard[]> {
  try {
    return await loadBuyerListedProducts(limit)
  } catch (err) {
    console.error("[buyer-discovery] loadBuyerListedProducts failed:", err)
    return []
  }
}

/** Products for home: bestsellers when orders exist, else fresh listed SKUs. */
export async function loadBuyerHomeProducts(limit = 24): Promise<BuyerListingCard[]> {
  const listed = await loadBuyerListedProducts(limit)
  if (listed.length >= 4) return listed

  const [bestsellers, arrivals] = await Promise.all([
    loadHomeBestSellers7d(limit),
    loadHomeNewArrivals(limit),
  ])

  const byListingId = new Map<string, BuyerListingCard>()
  for (const c of listed) byListingId.set(c.listingId, c)

  for (const item of [...bestsellers, ...arrivals]) {
    if (byListingId.size >= limit) break
    const row = await prisma.affiliateProduct.findFirst({
      where: { id: item.listingId, isListed: true },
      select: listingSelect,
    })
    if (!row) continue
    const card = mapRow(row, item.soldCount)
    if (card && !byListingId.has(card.listingId)) byListingId.set(card.listingId, card)
  }

  return [...byListingId.values()].slice(0, limit)
}

export async function loadBuyerHomeProductsSafe(limit = 24): Promise<BuyerListingCard[]> {
  try {
    return await loadBuyerHomeProducts(limit)
  } catch (err) {
    console.error("[buyer-discovery] loadBuyerHomeProducts failed:", err)
    return []
  }
}

export async function loadBuyerCategoryChips(max = 10): Promise<BuyerCategoryChip[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: buyerListedAffiliateProductWhere,
    select: { product: { select: { categories: true } } },
    take: 200,
  })

  const counts = new Map<string, number>()
  for (const l of listings) {
    for (const cat of l.product.categories ?? []) {
      const key = cat.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({
      id: name,
      name,
      browseQuery: name,
      count,
    }))
}

export async function loadBuyerCategoryChipsSafe(max = 10): Promise<BuyerCategoryChip[]> {
  try {
    return await loadBuyerCategoryChips(max)
  } catch (err) {
    console.error("[buyer-discovery] loadBuyerCategoryChips failed:", err)
    return []
  }
}

export async function loadBuyerListingCount(): Promise<number> {
  return prisma.affiliateProduct.count({
    where: buyerListedAffiliateProductWhere,
  })
}
