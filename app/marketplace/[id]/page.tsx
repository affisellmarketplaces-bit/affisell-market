import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { filterListingForPromotedVariants } from "@/lib/affiliate-storefront-variants"
import {
  listingDisplayDescription,
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { loadMarketplaceListingPageData } from "@/lib/marketplace-listing-page-loader"
import { shippingCountryLabel } from "@/lib/product-shipping-display"
import { mergeColorImagesForProduct, parseProductColorImagesFromDb } from "@/lib/product-color-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"
import {
  buildCustomColumnProductSpecs,
  parseCustomColumnsFromDb,
} from "@/lib/product-custom-columns"
import { resolveMarketplaceOptionNames, variantsFromDb } from "@/lib/product-variants"
import { primaryProductImage } from "@/lib/product-images"
import { buildAggregateRatingJsonLd } from "@/lib/reviews/json-ld"
import {
  buildProductListingMetadata,
  buildProductOfferJsonLd,
} from "@/lib/product-listing-seo"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

import { MarketplaceListingDetail } from "./marketplace-listing-detail"

export const revalidate = 60

export async function buildListingMetadataForId(
  listingId: string,
  storeSlug?: string
): Promise<Metadata> {
  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: listingId,
      isListed: true,
      product: buyerMarketplaceProductWhere,
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

export default async function MarketplaceListingPage({
  params,
  searchParams,
  storeSlug,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ writeReview?: string; orderId?: string }>
  /** When set (shop PDP), listing must belong to this store — single DB round-trip. */
  storeSlug?: string
}) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, auth()])

  const loaded = await loadMarketplaceListingPageData({
    listingId: id,
    storeSlug,
    buyerUserId: session?.user?.id ?? null,
    orderId: sp.orderId ?? null,
  })
  if (!loaded) notFound()

  const { listing, oftenRaw, fallbackRaw, viewsLast24h, writeReviewOrderId } = loaded

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
  const variantsRaw = variantsFromDb(listing.product.variants)
  const colorNamesRaw = resolveMarketplaceOptionNames(productColorNames, variantsRaw)
  const { variants, colorNames } = filterListingForPromotedVariants({
    variants: variantsRaw,
    colorNames: colorNamesRaw,
    promotedVariantKeys: listing.promotedVariantKeys,
  })
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
      href: storeSlug
        ? `/shops/${encodeURIComponent(storeSlug)}/product/${r.id}`
        : `/marketplace/${r.id}`,
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
  const aggregateRating = buildAggregateRatingJsonLd({
    productName: displayName,
    averageRating: listing.product.averageRating,
    reviewCount: listing.product.reviewCount,
  })
  if (aggregateRating && productJsonLd && typeof productJsonLd === "object") {
    ;(productJsonLd as Record<string, unknown>).aggregateRating = aggregateRating
  }

  return (
    <main className="affisell-pdp-viewport relative min-h-screen w-full max-w-[100vw] overflow-x-clip bg-gradient-to-b from-zinc-100/95 via-white to-violet-100/45 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.14),transparent_52%)] dark:bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto min-w-0 max-w-6xl px-4 py-8 pb-28 md:px-8 md:py-10 lg:py-12 lg:pb-12">
        <MarketplaceListingDetail
          audience="customer"
          listingId={listing.id}
          productId={listing.product.id}
          promotedColor={listing.promotedColor}
          promotedSize={listing.promotedSize}
          name={displayName}
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
            ugcCount: listing.product.ugcCount,
          }}
          buyerRewardBadge={buyerRewardBadge}
          writeReviewOrderId={writeReviewOrderId}
          openWriteReview={sp.writeReview === "true" && Boolean(writeReviewOrderId)}
          viewsLast24h={viewsLast24h}
          galleryListingVideoUrl={
            typeof p.videoAdUrl === "string" && p.videoAdUrl.trim() ? p.videoAdUrl.trim() : null
          }
        />
      </div>
    </main>
  )
}
