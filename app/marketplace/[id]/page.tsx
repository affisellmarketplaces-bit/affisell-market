import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound, redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { headers } from "next/headers"

import { auth } from "@/auth"
import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { GraduatedCheckoutPermanentBanner } from "@/components/marketplace/graduated-checkout-permanent-banner"
import { RolloutShippingConfirmedBanner } from "@/components/marketplace/rollout-shipping-confirmed-banner"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { filterListingForPromotedVariants } from "@/lib/affiliate-storefront-variants"
import {
  listingDisplayDescription,
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import { shopListingPath } from "@/lib/affiliate-routes"
import { isAffiliateOwnerPreviewUrl } from "@/lib/affiliate-store-preview-access"
import { loadMarketplaceListingPageData } from "@/lib/marketplace-listing-page-loader"
import { buildListingLogisticsInput } from "@/lib/listing-logistics-display"
import { mergeColorImagesForProduct, parseProductColorImagesFromDb, enrichGalleryWithColorHeroImages } from "@/lib/product-color-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"
import {
  buildCustomColumnProductSpecs,
  parseCustomColumnsFromDb,
} from "@/lib/product-custom-columns"
import {
  collectStorageOptionValues,
  resolveMarketplacePrimaryOptionNames,
  variantsWithProductVariantRows,
} from "@/lib/marketplace-variant-dimensions"
import { variantsFromDb } from "@/lib/product-variants"
import { primaryProductImage } from "@/lib/product-images"
import { buildAggregateRatingJsonLd } from "@/lib/reviews/json-ld"
import {
  buildProductListingMetadata,
  buildProductOfferJsonLd,
} from "@/lib/product-listing-seo"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import type { AppLocale } from "@/lib/i18n-locale"
import { offerModeBadge, parseProductOfferMode } from "@/lib/product-offer-mode"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { cn } from "@/lib/utils"
import {
  isGraduatedCheckoutCountryResolved,
  isRolloutOnlyCheckoutCountryResolved,
  isStripeCheckoutCountryResolved,
} from "@/lib/checkout-country-rollout"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"
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
  const resolved =
    listing ??
    (storeSlug
      ? await prisma.affiliateProduct.findFirst({
          where: {
            id: listingId,
            isListed: true,
            product: buyerMarketplaceProductWhere,
            affiliate: { role: "AFFILIATE" },
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
      : null)
  if (!resolved?.product) return { title: "Produit" }
  const name = listingDisplayTitle(resolved.customTitle, resolved.product.name)
  const imageUrl =
    primaryProductImage(resolved.customImages) ||
    primaryProductImage(resolved.product.images) ||
    null
  return buildProductListingMetadata({
    name,
    description: listingDisplayDescription(resolved.customDescription, resolved.product.description),
    imageUrl,
    priceCents: resolved.sellingPriceCents,
    inStock: resolved.product.stock > 0,
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
  searchParams: Promise<{ writeReview?: string; orderId?: string; preview?: string }>
  /** When set (shop PDP), listing must belong to this store — single DB round-trip. */
  storeSlug?: string
}) {
  const [{ id }, sp, session, locale, requestHeaders] = await Promise.all([
    params,
    searchParams,
    auth(),
    getLocale(),
    headers(),
  ])
  const visitorCountry = resolveVisitorCountryIso2(requestHeaders)
  const checkoutAvailable = visitorCountry ? await isStripeCheckoutCountryResolved(visitorCountry) : true
  const graduatedCheckout =
    visitorCountry && checkoutAvailable
      ? await isGraduatedCheckoutCountryResolved(visitorCountry)
      : false
  const rolloutOnly =
    visitorCountry && checkoutAvailable && !graduatedCheckout
      ? await isRolloutOnlyCheckoutCountryResolved(visitorCountry)
      : false

  const isAffiliateSession = String(session?.user?.role ?? "").toUpperCase() === "AFFILIATE"
  const ownerPreviewByQuery = isAffiliateOwnerPreviewUrl({
    get: (key) => (key === "preview" ? sp.preview ?? null : null),
  })
  const loaded = await loadMarketplaceListingPageData({
    listingId: id,
    storeSlug,
    buyerUserId: session?.user?.id ?? null,
    orderId: sp.orderId ?? null,
    allowOwnerPreview: isAffiliateSession && (ownerPreviewByQuery || Boolean(storeSlug)),
    ownerAffiliateUserId: session?.user?.id ?? null,
  })
  if (!loaded) notFound()
  if (storeSlug && loaded.canonicalRedirect) {
    redirect(shopListingPath(loaded.canonicalRedirect, id))
  }
  if (loaded.listingIdRedirect) {
    const canonicalId = loaded.listingIdRedirect
    const previewQs = sp.preview === "affiliate" ? "?preview=affiliate" : ""
    if (storeSlug) {
      redirect(`${shopListingPath(storeSlug, canonicalId)}${previewQs}`)
    }
    redirect(`/marketplace/${canonicalId}${previewQs}`)
  }

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
  const customCols = parseCustomColumnsFromDb(listing.product.customColumns)
  const variantsRaw = variantsWithProductVariantRows(
    variantsFromDb(listing.product.variants),
    listing.product.productVariants ?? [],
    customCols,
    listing.product.basePriceCents
  )
  const storageOptionsRaw = collectStorageOptionValues({
    variants: variantsRaw,
    customColumns: customCols,
    productVariantCustomData: listing.product.productVariants?.map((v) => v.customData),
  })
  const colorNamesRaw = resolveMarketplacePrimaryOptionNames(
    productColorNames,
    variantsRaw,
    storageOptionsRaw
  )
  const { variants, colorNames } = filterListingForPromotedVariants({
    variants: variantsRaw,
    colorNames: colorNamesRaw,
    promotedVariantKeys: listing.promotedVariantKeys,
  })
  const storageOptions = collectStorageOptionValues({
    variants,
    customColumns: customCols,
    productVariantCustomData: listing.product.productVariants?.map((v) => v.customData),
  })
  const colorImages =
    colorNames.length > 0
      ? mergeColorImagesForProduct(colorNames, listing.product.colorImages, listing.product.variants)
      : (parseProductColorImagesFromDb(listing.product.colorImages) ?? [])

  const galleryForPdp = enrichGalleryWithColorHeroImages(gallery, colorNames, colorImages)

  const buyerRewardBadge = buyerRewardBadgeText(
    normalizeBuyerRewardKind(listing.buyerRewardKind),
    listing.buyerRewardPercent ?? 0
  )

  const p = listing.product
  const offerMode = parseProductOfferMode(p.offerMode)
  const offerBadge = offerModeBadge(offerMode, locale as AppLocale)
  const sellingEur = listing.sellingPriceCents / 100
  const compareAtEur = p.compareAt != null ? Number(p.compareAt) : null
  const retailPriceEur =
    compareAtEur != null && Number.isFinite(compareAtEur) && compareAtEur > sellingEur ? compareAtEur : undefined

  const freeThresh =
    p.freeShippingThreshold != null && Number(p.freeShippingThreshold) > 0
      ? Number(p.freeShippingThreshold)
      : null

  const shipping = {
    ...buildListingLogisticsInput({
      shippingCountry: p.shippingCountry,
      warehouseType: p.warehouseType,
      warehouseCity: p.warehouseCity,
      shipsFrom: p.shipsFrom,
      deliveryMin: p.deliveryMin,
      deliveryMax: p.deliveryMax,
    }),
    processingTime: p.processingTime ?? 1,
    freeShippingThresholdEUR: freeThresh,
  }

  const mapRelated = (
    rows: Array<{
      id: string
      sellingPriceCents: number
      conversions: number
      customTitle: string | null
      customImages: string[]
      product: { name: string; images: string[] }
      affiliate?: { store: { slug: string } | null } | null
    }>
  ) =>
    rows.map((r) => {
      const rowStoreSlug = r.affiliate?.store?.slug?.trim()
      const href = rowStoreSlug
        ? shopListingPath(rowStoreSlug, r.id)
        : storeSlug
          ? shopListingPath(storeSlug, r.id)
          : `/marketplace/${r.id}`
      return {
        id: r.id,
        href,
        title: listingDisplayTitle(r.customTitle, r.product.name),
        image: listingGalleryUrls(r.customImages, r.product.images ?? [])[0] ?? "/placeholder.png",
        priceEur: r.sellingPriceCents / 100,
        soldCount: normalizeListingSalesCount(r.conversions),
      }
    })

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

  const customSpecs = buildCustomColumnProductSpecs(
    customCols,
    listing.product.productVariants ?? []
  )
  const productSpecs = [
    ...customSpecs,
    ...(listing.product.attributes ?? [])
      .map((row) => ({
        label: String(row.label || row.key || "").trim(),
        value: String(row.value ?? "").trim(),
      }))
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
  if (
    (listing.product.supplier.isVerifiedSupplier ||
      (listing.product.supplier.supplierTrustTier &&
        listing.product.supplier.supplierTrustTier !== "NONE")) &&
    productJsonLd &&
    typeof productJsonLd === "object"
  ) {
    ;(productJsonLd as Record<string, unknown>).brand = {
      "@type": "Brand",
      name: listing.product.supplier.name?.trim() || "Affisell+ Supplier",
    }
  }

  return (
    <MarketplaceListingPageShell
      storeSlug={storeSlug}
      checkoutAvailable={checkoutAvailable}
      visitorCountry={visitorCountry}
      graduatedCheckout={graduatedCheckout}
      rolloutOnly={rolloutOnly}
      productJsonLd={productJsonLd}
    >
      <MarketplaceListingDetail
        brandedStorefront={Boolean(storeSlug)}
          audience="customer"
          listingId={listing.id}
          productId={listing.product.id}
          listingKind={listing.product.listingKind ?? "PHYSICAL"}
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
          isVerifiedSupplier={listing.product.supplier.isVerifiedSupplier}
          supplierTrustTier={listing.product.supplier.supplierTrustTier}
          storefront={storefront}
          gallery={galleryForPdp}
          categories={categories}
          colorNames={colorNames}
          storageOptions={storageOptions}
          customColumns={customCols}
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
          offerBadge={offerBadge}
          writeReviewOrderId={writeReviewOrderId}
          openWriteReview={sp.writeReview === "true" && Boolean(writeReviewOrderId)}
          viewsLast24h={viewsLast24h}
          salesCount={listing.conversions}
          galleryListingVideoUrl={
            typeof p.videoAdUrl === "string" && p.videoAdUrl.trim() ? p.videoAdUrl.trim() : null
          }
        />
    </MarketplaceListingPageShell>
  )
}

function MarketplaceListingPageShell({
  storeSlug,
  checkoutAvailable,
  visitorCountry,
  graduatedCheckout,
  rolloutOnly,
  productJsonLd,
  children,
}: {
  storeSlug?: string
  checkoutAvailable: boolean
  visitorCountry: string | null
  graduatedCheckout: boolean
  rolloutOnly: boolean
  productJsonLd: unknown
  children: ReactNode
}) {
  const brand = storefrontPdpBrandClasses(Boolean(storeSlug))
  return (
    <main
      className={cn(
        "affisell-pdp-viewport relative min-h-screen w-full max-w-[100vw] overflow-x-clip",
        brand.pageShell
      )}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className={cn("pointer-events-none absolute inset-0", brand.pageGlow)} aria-hidden />
      <div className="relative mx-auto min-w-0 max-w-6xl px-4 py-6 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:px-8 md:py-10 md:pb-12 lg:py-12">
        {!checkoutAvailable && visitorCountry ? (
          <CheckoutRegionComingSoonBanner
            className="mb-4"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable={false}
          />
        ) : graduatedCheckout && visitorCountry ? (
          <GraduatedCheckoutPermanentBanner
            className="mb-4"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            graduatedCheckout
          />
        ) : rolloutOnly && visitorCountry ? (
          <RolloutShippingConfirmedBanner
            className="mb-4"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            rolloutOnly
          />
        ) : null}
        {children}
      </div>
    </main>
  )
}
