import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

import { MarketplaceListingDetail } from "./marketplace-listing-detail"

export const dynamic = "force-dynamic"

export default async function MarketplaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, active: true, product: { active: true } },
    include: {
      product: true,
      affiliate: { include: { affiliateStore: { select: { slug: true } } } },
    },
  })

  if (!listing?.product) notFound()

  const sellerLabel = listing.affiliate.affiliateStore?.slug ?? listing.affiliate.email
  const gallery = (listing.product.images ?? []).map((s) => s.trim()).filter(Boolean)
  const priceDisplay = (listing.sellingPriceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
  })

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <MarketplaceListingDetail
        listingId={listing.id}
        name={listing.product.name}
        description={listing.product.description}
        sellerLabel={sellerLabel}
        priceDisplay={priceDisplay}
        gallery={gallery}
      />
    </main>
  )
}
