import { Prisma } from "@prisma/client"

import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { listingWarrantyBadgeLabel, resolveProductWarrantyMonths } from "@/lib/product-warranty"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export type ShopStoreSummary = {
  userId: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  aiAvatarUrl: string | null
  nicheLabel: NicheKey
}

export type ShopProductCard = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  compareAtCents: number | null
  freeShipping: boolean
  stock: number
  averageRating: number
  reviewCount: number
  warrantyLabel?: string | null
  /** Present only when serialized for affiliate preview (never on public buyer pages). */
  marginCents?: number
  commissionPct?: number
  soldCount?: number
}

/** Canonical niche key — filters and i18n use this, not a display string. */
export type NicheKey = "beauty" | "fitness" | "tech" | "home" | "lifestyle"

/** Public directory niche — must match filters on `/shops` and `discovery.niches.*`. */
export function inferNicheLabel(description: string | null, storeName: string): NicheKey {
  const text = `${description ?? ""} ${storeName}`.toLowerCase()
  if (/beaut|beauté|cosmét|cosmetic|makeup|soin|skincare|parfum|spa/.test(text)) return "beauty"
  if (/fitness|sport|gym|muscu/.test(text)) return "fitness"
  if (/tech|électron|electron|gaming|informatique/.test(text)) return "tech"
  if (/maison|déco|deco|cuisine|home/.test(text)) return "home"
  return "lifestyle"
}

export async function loadAffiliateShopStore(slug: string): Promise<ShopStoreSummary | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      userId: true,
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      aiAvatarUrl: true,
      user: { select: { role: true } },
    },
  })
  if (!store || store.user.role !== "AFFILIATE") return null

  return {
    userId: store.userId,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    aiAvatarUrl: store.aiAvatarUrl,
    nicheLabel: inferNicheLabel(store.description, store.name),
  }
}

export async function loadAffiliateShopProducts(
  affiliateUserId: string,
  options?: { includeBusinessFields?: boolean },
  limit = 48
): Promise<ShopProductCard[]> {
  const includeBusiness = options?.includeBusinessFields === true
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: affiliateUserId,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      showWarranty: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          stock: true,
          freeShipping: true,
          compareAt: true,
          averageRating: true,
          reviewCount: true,
          variants: true,
          hasVariants: true,
          ...(includeBusiness
            ? { basePriceCents: true, commissionRate: true }
            : {}),
        },
      },
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    take: limit,
  })

  const soldByProduct = new Map<string, number>()
  if (includeBusiness && listings.length > 0) {
    const productIds = [...new Set(listings.map((l) => l.product?.id).filter(Boolean))] as string[]
    if (productIds.length > 0) {
      const soldGroups = await prisma.order.groupBy({
        by: ["productId"],
        where: { affiliateId: affiliateUserId, productId: { in: productIds } },
        _count: { _all: true },
      })
      for (const g of soldGroups) {
        soldByProduct.set(g.productId, g._count._all)
      }
    }
  }

  const variantProductIds = [
    ...new Set(listings.filter((l) => l.product?.hasVariants).map((l) => l.product!.id)),
  ]
  const variantRows =
    variantProductIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { productId: { in: variantProductIds } },
          select: { productId: true, customData: true },
        })
      : []
  const variantsByProductId = new Map<string, Array<{ customData: unknown }>>()
  for (const variant of variantRows) {
    const list = variantsByProductId.get(variant.productId) ?? []
    list.push({ customData: variant.customData })
    variantsByProductId.set(variant.productId, list)
  }

  return listings
    .filter((l) => l.product)
    .map((l) => {
      const p = l.product!
      const compareAt =
        p.compareAt != null && Number(p.compareAt) > 0 ? Math.round(Number(p.compareAt) * 100) : null
      const warrantyMonths = resolveProductWarrantyMonths({
        variants: p.variants,
        hasVariants: p.hasVariants,
        productVariants: variantsByProductId.get(p.id),
      })
      return {
        listingId: l.id,
        productId: p.id,
        name: listingDisplayTitle(l.customTitle, p.name),
        imageUrl:
          listingPrimaryImageUrl(l.customImages, p.images) || primaryProductImage(p.images) || null,
        priceCents: l.sellingPriceCents,
        compareAtCents:
          compareAt != null && compareAt > l.sellingPriceCents ? compareAt : null,
        freeShipping: p.freeShipping,
        stock: p.stock,
        averageRating: p.averageRating,
        reviewCount: p.reviewCount,
        warrantyLabel: listingWarrantyBadgeLabel(l.showWarranty, warrantyMonths),
        ...(includeBusiness
          ? {
              marginCents: Math.max(0, l.sellingPriceCents - p.basePriceCents),
              commissionPct: Math.round(Number(p.commissionRate) || 0),
              soldCount: soldByProduct.get(p.id) ?? 0,
            }
          : {}),
      }
    })
}

export type PublicShopDirectoryEntry = {
  slug: string
  name: string
  logoUrl: string | null
  nicheLabel: NicheKey
  /** Aggregate average rating from listed products (0–5). */
  averageRating: number
  /** Completed orders attributed to this affiliate’s storefront channel. */
  orderCount: number
}

async function loadAffiliateListedRatingAverages(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (userIds.length === 0) return map

  const rows = await prisma.$queryRaw<{ affiliate_id: string; avg: number | null }[]>`
    SELECT ap."affiliateId" AS affiliate_id,
           AVG(p."averageRating")::double precision AS avg
    FROM "AffiliateProduct" ap
    INNER JOIN "Product" p ON p.id = ap."productId"
    WHERE ap."isListed" = true
      AND p.active = true
      AND p."isDraft" = false
      AND ap."affiliateId" IN (${Prisma.join(userIds)})
    GROUP BY ap."affiliateId"
  `

  for (const row of rows) {
    map.set(row.affiliate_id, row.avg != null && Number.isFinite(row.avg) ? row.avg : 0)
  }
  return map
}

/** Public directory — no wholesale / margin fields. */
export async function loadPublicAffiliateShops(limit = 500): Promise<PublicShopDirectoryEntry[]> {
  const stores = await prisma.store.findMany({
    where: { user: { role: "AFFILIATE" } },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      aiAvatarUrl: true,
      description: true,
      userId: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  })

  const userIds = stores.map((s) => s.userId)
  const [orderGroups, ratingMap] = await Promise.all([
    userIds.length === 0
      ? ([] as { affiliateId: string; _count: { _all: number } }[])
      : prisma.order.groupBy({
          by: ["affiliateId"],
          where: { affiliateId: { in: userIds } },
          _count: { _all: true },
        }),
    loadAffiliateListedRatingAverages(userIds),
  ])

  const orderCountByAffiliate = new Map(orderGroups.map((g) => [g.affiliateId, g._count._all]))

  return stores.map((s) => ({
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl ?? s.aiAvatarUrl,
    nicheLabel: inferNicheLabel(s.description, s.name),
    averageRating: ratingMap.get(s.userId) ?? 0,
    orderCount: orderCountByAffiliate.get(s.userId) ?? 0,
  }))
}

/** Slugs only — sitemap-friendly. */
export async function loadPublicAffiliateShopSlugs(limit = 2000): Promise<string[]> {
  const rows = await prisma.store.findMany({
    where: { user: { role: "AFFILIATE" } },
    select: { slug: true },
    orderBy: { name: "asc" },
    take: limit,
  })
  return rows.map((r) => r.slug)
}

export function shopProductToCardProps(item: ShopProductCard, storeSlug: string) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    freeShipping: item.freeShipping,
    warrantyLabel: item.warrantyLabel ?? null,
    stock: item.stock,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    ...(item.marginCents != null ? { marginCents: item.marginCents } : {}),
    ...(item.commissionPct != null ? { commissionPct: item.commissionPct } : {}),
    ...(item.soldCount != null ? { soldCount: item.soldCount } : {}),
    href: `/shops/${storeSlug}/product/${item.listingId}`,
  }
}
