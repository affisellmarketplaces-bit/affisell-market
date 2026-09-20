import "server-only"

import { unstable_cache } from "next/cache"

import {
  listingDisplayTitle,
  listingPrimaryImageUrl,
  pickListingCardImageUrl,
} from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { SELECTION_MIN_ITEMS, scoreSelectionCandidate } from "@/lib/home-selection"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"
import { loadListingSalesStats } from "@/lib/listing-sales-stats"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { loadSupplierShopShippingOffersMap } from "@/lib/shipping/supplier-shipping-profile.server"

export type SelectionItem = {
  id: string
  href: string
  title: string
  image: string
  priceCents: number
  verified: boolean
  /** Supplier-declared delivery window (min of mins … max of maxes), null when not declared. */
  delivery: { min: number; max: number } | null
  rating: number | null
  reviews: number
}

const CANDIDATES = 120
const SHELF = 6

async function loadSelection(): Promise<SelectionItem[]> {
  const ranked = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: { ...buyerListedAffiliateProductWhere, affiliate: { store: { isNot: null } } },
      orderBy: [{ isFeatured: "desc" }, { conversions: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
      take: CANDIDATES,
      select: {
        id: true,
        affiliateId: true,
        sellingPriceCents: true,
        customTitle: true,
        product: { select: { id: true, name: true, supplierId: true, averageRating: true, reviewCount: true } },
      },
    })
  )
  if (ranked.length === 0) return []

  const affiliateIds = [...new Set(ranked.map((r) => r.affiliateId))]
  const supplierIds = [...new Set(ranked.map((r) => r.product.supplierId))]
  const [sales, legal, shipping] = await Promise.all([
    loadListingSalesStats(ranked.map((r) => r.id)),
    withPrismaReconnect(() =>
      prisma.merchantLegalProfile.findMany({
        where: { userId: { in: affiliateIds }, verificationStatus: "APPROVED" },
        select: { userId: true },
      })
    ),
    loadSupplierShopShippingOffersMap(supplierIds),
  ])
  const verified = new Set(legal.map((l) => l.userId))

  const seenProducts = new Set<string>()
  const chosen = ranked
    .map((r) => {
      const offers = shipping.get(r.product.supplierId) ?? []
      const title = listingDisplayTitle(r.customTitle, r.product.name)
      const { score, qualifies } = scoreSelectionCandidate({
        title,
        merchantVerified: verified.has(r.affiliateId),
        hasDeliveryProfile: offers.length > 0,
        rating: r.product.averageRating,
        reviewCount: r.product.reviewCount,
        confirmedUnits: sales.get(r.id)?.units ?? 0,
      })
      return { r, offers, qualifies, score }
    })
    .filter((c) => c.qualifies)
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seenProducts.has(c.r.product.id) ? false : (seenProducts.add(c.r.product.id), true)))
    .slice(0, SHELF + 2) // over-pick: a few may lose their tile for lack of a real image
  if (chosen.length < SELECTION_MIN_ITEMS) return []

  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: { id: { in: chosen.map((c) => c.r.id) } },
      select: {
        id: true,
        customImages: true,
        customSlug: true,
        product: { select: { images: true } },
        affiliate: { select: { store: { select: { slug: true } } } },
      },
    })
  )
  const detail = new Map(rows.map((r) => [r.id, r]))

  const items: SelectionItem[] = []
  for (const c of chosen) {
    const d = detail.get(c.r.id)
    if (!d) continue
    const rawImage =
      pickListingCardImageUrl(d.customImages ?? [], d.product.images ?? []) ??
      (listingPrimaryImageUrl(d.customImages ?? [], d.product.images ?? []) || null)
    if (!rawImage) continue // never a placeholder tile
    const slug = d.affiliate.store?.slug
    items.push({
      id: c.r.id,
      href: slug ? shopListingPath(slug, c.r.id, d.customSlug) : `/marketplace/${encodeURIComponent(c.r.id)}`,
      title: listingDisplayTitle(c.r.customTitle, c.r.product.name),
      image: resolveListingCardImageHref(rawImage, c.r.id),
      priceCents: c.r.sellingPriceCents,
      verified: verified.has(c.r.affiliateId),
      delivery: c.offers.length
        ? { min: Math.min(...c.offers.map((o) => o.deliveryMin)), max: Math.max(...c.offers.map((o) => o.deliveryMax)) }
        : null,
      rating: c.r.product.reviewCount >= 3 && c.r.product.averageRating > 0 ? Math.round(c.r.product.averageRating * 10) / 10 : null,
      reviews: c.r.product.reviewCount,
    })
    if (items.length === SHELF) break
  }
  return items.length >= SELECTION_MIN_ITEMS ? items : []
}

const loadSelectionCached = unstable_cache(loadSelection, ["home-selection-v1"], { revalidate: 120, tags: ["home", "home-selection"] })

export async function loadHomeSelectionSafe(timeoutMs = 3000): Promise<SelectionItem[]> {
  try {
    return await Promise.race([
      loadSelectionCached(),
      new Promise<SelectionItem[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ])
  } catch (error) {
    console.error("[home-selection]", error instanceof Error ? error.message : String(error))
    return []
  }
}
