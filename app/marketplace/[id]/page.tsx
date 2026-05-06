import { notFound } from "next/navigation"

import {
  listingDisplayDescription,
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { shippingCountryLabel } from "@/lib/product-shipping-display"
import { parseProductColorImagesFromDb } from "@/lib/product-color-images"
import { prisma } from "@/lib/prisma"
import { variantsFromDb } from "@/lib/product-variants"

import { MarketplaceListingDetail } from "./marketplace-listing-detail"

export const dynamic = "force-dynamic"

export default async function MarketplaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, isListed: true, product: { active: true } },
    include: {
      product: true,
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
        showTrustedSoldBy: Boolean(st.customDomain && st.domainVerified),
      }
    : null
  const sellerLabel = st?.name ?? listing.affiliate.name?.trim() ?? listing.affiliate.email
  const gallery = listingGalleryUrls(listing.customImages, listing.product.images ?? [])
  const categories = Array.isArray(listing.product.categories)
    ? listing.product.categories.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []
  const colorNames = Array.isArray(listing.product.colors)
    ? listing.product.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []
  const tags = Array.isArray(listing.product.tags)
    ? listing.product.tags.filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
    : []
  const variants = variantsFromDb(listing.product.variants)
  const colorImages = parseProductColorImagesFromDb(listing.product.colorImages) ?? []

  const priceDisplay = (listing.sellingPriceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
  })

  const p = listing.product
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

  const reviews = await prisma.review.findMany({
    where: { productId: listing.product.id },
    orderBy: { helpful_count: "desc" },
    take: 20,
  })

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <MarketplaceListingDetail
        listingId={listing.id}
        name={listingDisplayTitle(listing.customTitle, listing.product.name)}
        description={listingDisplayDescription(
          listing.customDescription,
          listing.product.description
        )}
        sellerLabel={sellerLabel}
        storefront={storefront}
        priceDisplay={priceDisplay}
        gallery={gallery}
        categories={categories}
        colorNames={colorNames}
        tags={tags}
        variants={variants}
        colorImages={colorImages}
        shipping={shipping}
        listingPriceCents={listing.sellingPriceCents}
        reviewSummary={{
          count: listing.product.reviewCount,
          average: listing.product.averageRating,
          sentiment: listing.product.reviewSentiment,
        }}
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
      />
    </main>
  )
}
