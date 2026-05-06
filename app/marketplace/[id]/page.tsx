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
  const has3D = tags.some((t) => /(?:\b3d\b|\b360\b)/i.test(t))
  const arModel = tags.find((t) => t.toLowerCase().startsWith("ar:"))?.slice(3) ?? null
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
        stock={listing.product.stock}
        retailPriceEur={listing.product.basePriceCents / 100}
        has3D={has3D}
        arModel={arModel}
        oftenBoughtTogether={oftenBoughtTogether}
        alsoViewed={alsoViewed}
        reviewSummary={{
          count: listing.product.reviewCount,
          average: listing.product.averageRating,
          sentiment: listing.product.reviewSentiment,
        }}
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
      />
    </main>
  )
}
