import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import {
  listingDisplayDescription,
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { shippingCountryLabel } from "@/lib/product-shipping-display"
import { mergeColorImagesForProduct, parseProductColorImagesFromDb } from "@/lib/product-color-images"
import { prisma } from "@/lib/prisma"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"
import {
  buildCustomColumnProductSpecs,
  parseCustomColumnsFromDb,
} from "@/lib/product-custom-columns"
import { resolveMarketplaceOptionNames, variantsFromDb } from "@/lib/product-variants"
import { primaryProductImage } from "@/lib/product-images"
import {
  buildProductListingMetadata,
  buildProductOfferJsonLd,
} from "@/lib/product-listing-seo"

import { MarketplaceListingDetail } from "./marketplace-listing-detail"

export const dynamic = "force-dynamic"

export async function buildListingMetadataForId(
  listingId: string,
  storeSlug?: string
): Promise<Metadata> {
  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: listingId,
      isListed: true,
      product: { active: true },
      affiliate: {
        role: "AFFILIATE",
        ...(storeSlug ? { store: { slug: storeSlug } } : {}),
      },
    },
    select: {
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      customDescription: true,
      product: {
        select: {
          name: true,
          description: true,
          images: true,
          stock: true,
        },
      },
    },
  })
  if (!listing?.product) return { title: "Produit" }
  const name = listingDisplayTitle(listing.customTitle, listing.product.name)
  const imageUrl =
    primaryProductImage(listing.customImages) ||
    primaryProductImage(listing.product.images) ||
    null
  return buildProductListingMetadata({
    name,
    description: listingDisplayDescription(listing.customDescription, listing.product.description),
    imageUrl,
    priceCents: listing.sellingPriceCents,
    inStock: listing.product.stock > 0,
    customerFacing: true,
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return buildListingMetadataForId(id)
}

export default async function MarketplaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      isListed: true,
      product: { active: true },
      affiliate: { role: "AFFILIATE" },
    },
    include: {
      product: {
        include: {
          attributes: { orderBy: { label: "asc" } },
          productVariants: { select: { customData: true } },
        },
      },
      affiliate: { include: { store: true } },
    },
  })

  if (!listing?.product) notFound()

  const st = listing.affiliate.store
  const storefront = st
    ? {
        name: st.name,
        slug: st.slug,
        logoUrl: st.logoUrl,
        aiAvatarUrl: st.aiAvatarUrl,
        showTrustedSoldBy: Boolean(st.customDomain && st.domainVerified),
      }
    : null
  const sellerLabel = publicPartnerSellerLabel({
    storeName: st?.name,
    affiliateDisplayName: listing.affiliate.name,
  })
  const gallery = listingGalleryUrls(listing.customImages, listing.product.images ?? [])
  const categories = Array.isArray(listing.product.categories)
    ? listing.product.categories.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []
  const productColorNames = Array.isArray(listing.product.colors)
    ? listing.product.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []
  const tags = Array.isArray(listing.product.tags)
    ? listing.product.tags.filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
    : []
  const has3D = tags.some((t) => /(?:\b3d\b|\b360\b)/i.test(t))
  const arModel = tags.find((t) => t.toLowerCase().startsWith("ar:"))?.slice(3) ?? null
  const variants = variantsFromDb(listing.product.variants)
  const colorNames = resolveMarketplaceOptionNames(productColorNames, variants)
  const colorImages =
    colorNames.length > 0
      ? mergeColorImagesForProduct(colorNames, listing.product.colorImages, listing.product.variants)
      : (parseProductColorImagesFromDb(listing.product.colorImages) ?? [])

  const buyerRewardBadge = buyerRewardBadgeText(
    normalizeBuyerRewardKind(listing.buyerRewardKind),
    listing.buyerRewardPercent ?? 0
  )

  const p = listing.product
  const sellingEur = listing.sellingPriceCents / 100
  const compareAtEur = p.compareAt != null ? Number(p.compareAt) : null
  /** Shoppers only see MSRP-style compare-at — never supplier wholesale (`basePriceCents`). */
  const retailPriceEur =
    compareAtEur != null && Number.isFinite(compareAtEur) && compareAtEur > sellingEur ? compareAtEur : undefined

  const freeThresh =
    p.freeShippingThreshold != null && Number(p.freeShippingThreshold) > 0
      ? Number(p.freeShippingThreshold)
      : null

  const shipping = {
    deliveryMin: p.deliveryMin ?? 2,
    deliveryMax: p.deliveryMax ?? 5,
    processingTime: p.processingTime ?? 1,
    warehouseType: p.warehouseType ?? null,
    warehouseCity: p.warehouseCity ?? null,
    shippingCountryLabel: shippingCountryLabel(p.shippingCountry),
    freeShippingThresholdEUR: freeThresh,
  }

  let reviews: Array<{
    id: string
    rating: number
    author: string
    country: string | null
    date: Date
    text: string
    images: string[]
    variant: string | null
    helpful_count: number
    verified: boolean
  }> = []
  let ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  try {
    reviews =
      (await prisma.review?.findMany({
        where: { productId: listing.product.id },
        orderBy: { helpful_count: "desc" },
        take: 20,
      })) || []

    const stats = await prisma.review.groupBy({
      by: ["rating"],
      where: { productId: listing.product.id },
      _count: { rating: true },
    })

    ratingBreakdown = [5, 4, 3, 2, 1].reduce(
      (acc, star) => {
        acc[star] = stats.find((s) => s.rating === star)?._count.rating || 0
        return acc
      },
      {} as Record<number, number>
    )
  } catch (e) {
    console.error("Review fetch failed:", e)
  }

  const relatedBaseSelect = {
    id: true,
    sellingPriceCents: true,
    customTitle: true,
    customImages: true,
    product: {
      select: {
        name: true,
        images: true,
      },
    },
  } as const

  const oftenRaw = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      id: { not: listing.id },
      product: {
        active: true,
        ...(categories.length > 0 ? { categories: { hasSome: categories.slice(0, 3) } } : {}),
      },
    },
    select: relatedBaseSelect,
    take: 3,
  })

  const fallbackRaw =
    oftenRaw.length >= 3
      ? []
      : await prisma.affiliateProduct.findMany({
          where: {
            ...affiliateRoleMarketplaceWhere,
            isListed: true,
            id: { notIn: [listing.id, ...oftenRaw.map((r) => r.id)] },
            product: { active: true },
          },
          orderBy: { createdAt: "desc" },
          select: relatedBaseSelect,
          take: 3,
        })

  const mapRelated = (
    rows: Array<{
      id: string
      sellingPriceCents: number
      customTitle: string | null
      customImages: string[]
      product: { name: string; images: string[] }
    }>
  ) =>
    rows.map((r) => ({
      id: r.id,
      href: `/marketplace/${r.id}`,
      title: listingDisplayTitle(r.customTitle, r.product.name),
      image: listingGalleryUrls(r.customImages, r.product.images ?? [])[0] ?? "/placeholder.png",
      priceEur: r.sellingPriceCents / 100,
    }))

  const oftenBoughtTogether = mapRelated(oftenRaw).slice(0, 3)
  const alsoViewed = mapRelated([...fallbackRaw, ...oftenRaw]).slice(0, 3)

  const descriptionBullets =
    Array.isArray(p.descriptionBullets) && p.descriptionBullets.length > 0
      ? (p.descriptionBullets as unknown[]).filter((x): x is string => typeof x === "string").map((s) => s.trim())
          .filter(Boolean)
      : []

  const descriptionIllustrationImages =
    Array.isArray(p.descriptionIllustrationImages) && p.descriptionIllustrationImages.length > 0
      ? (p.descriptionIllustrationImages as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const descriptionIllustrationVideos =
    Array.isArray(p.descriptionIllustrationVideos) && p.descriptionIllustrationVideos.length > 0
      ? (p.descriptionIllustrationVideos as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const customCols = parseCustomColumnsFromDb(listing.product.customColumns)
  const customSpecs = buildCustomColumnProductSpecs(
    customCols,
    listing.product.productVariants ?? []
  )
  const productSpecs = [
    ...customSpecs,
    ...(listing.product.attributes ?? [])
      .map((row) => ({ label: String(row.label || row.key || "").trim(), value: row.value.trim() }))
      .filter((row) => row.label.length > 0 && row.value.length > 0),
  ]

  let viewsLast24h = 0
  try {
    const since = new Date()
    since.setUTCMinutes(since.getUTCMinutes() - 24 * 60)
    viewsLast24h = await prisma.affisellTrackEvent.count({
      where: {
        eventType: "view",
        productId: listing.product.id,
        createdAt: { gte: since },
      },
    })
  } catch {
    viewsLast24h = 0
  }

  const displayName = listingDisplayTitle(listing.customTitle, listing.product.name)
  const seoImage =
    primaryProductImage(listing.customImages) ||
    primaryProductImage(listing.product.images) ||
    null
  const productJsonLd = buildProductOfferJsonLd({
    name: displayName,
    imageUrl: seoImage,
    priceCents: listing.sellingPriceCents,
    inStock: listing.product.stock > 0,
    customerFacing: true,
  })

  return (
    <main className="affisell-pdp-viewport relative min-h-screen overflow-x-hidden bg-gradient-to-b from-zinc-100/95 via-white to-violet-100/45 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.14),transparent_52%)] dark:bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-8 lg:py-12">
      <MarketplaceListingDetail
        audience="customer"
        listingId={listing.id}
        productId={listing.product.id}
        promotedColor={listing.promotedColor}
        promotedSize={listing.promotedSize}
        name={listingDisplayTitle(listing.customTitle, listing.product.name)}
        description={listingDisplayDescription(
          listing.customDescription,
          listing.product.description
        )}
        descriptionBullets={descriptionBullets}
        descriptionIllustrationImages={descriptionIllustrationImages}
        descriptionIllustrationVideos={descriptionIllustrationVideos}
        productSpecs={productSpecs}
        sellerLabel={sellerLabel}
        storefront={storefront}
        gallery={gallery}
        categories={categories}
        colorNames={colorNames}
        tags={tags}
        variants={variants}
        colorImages={colorImages}
        shipping={shipping}
        listingPriceCents={listing.sellingPriceCents}
        basePriceCents={p.basePriceCents}
        stock={listing.product.stock}
        retailPriceEur={retailPriceEur}
        has3D={has3D}
        arModel={arModel}
        oftenBoughtTogether={oftenBoughtTogether}
        alsoViewed={alsoViewed}
        reviewSummary={{
          count: listing.product.reviewCount,
          average: listing.product.averageRating,
          sentiment: listing.product.reviewSentiment,
        }}
        buyerRewardBadge={buyerRewardBadge}
        ratingBreakdown={ratingBreakdown}
        reviews={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          author: r.author,
          country: r.country,
          date: r.date.toISOString(),
          text: r.text,
          images: r.images,
          variant: r.variant,
          helpful_count: r.helpful_count,
          verified: r.verified,
        }))}
        viewsLast24h={viewsLast24h}
        galleryListingVideoUrl={
          typeof p.videoAdUrl === "string" && p.videoAdUrl.trim() ? p.videoAdUrl.trim() : null
        }
      />
      </div>
    </main>
  )
}
