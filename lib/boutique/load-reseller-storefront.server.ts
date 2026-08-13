import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { stripDescriptionImageMarkers } from "@/lib/description-rich-content"

export type ResellerStorefrontProduct = {
  listingId: string
  title: string
  descriptionExcerpt: string
  imageUrl: string
  priceLabel: string
  marketplaceHref: string
}

export async function loadResellerStorefrontProduct(
  listingId: string | null | undefined
): Promise<ResellerStorefrontProduct | null> {
  const id = listingId?.trim()
  if (!id) return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      customTitle: true,
      customDescription: true,
      sellingPriceCents: true,
      customImages: true,
      product: {
        select: {
          name: true,
          description: true,
          images: true,
        },
      },
    },
  })

  if (!listing?.product) return null

  const rawDescription = listing.customDescription?.trim() || listing.product.description
  const plainDescription = stripDescriptionImageMarkers(rawDescription).replace(/\s+/g, " ").trim()

  return {
    listingId: listing.id,
    title: listingDisplayTitle(listing.customTitle, listing.product.name),
    descriptionExcerpt: plainDescription.slice(0, 420),
    imageUrl: listingPrimaryImageUrl(listing.customImages, listing.product.images) || "/placeholder.png",
    priceLabel: formatStoreCurrencyFromCents(listing.sellingPriceCents),
    marketplaceHref: `/marketplace/${listing.id}`,
  }
}

export function formatResellerStoreLabel(storeSlug: string): string {
  return storeSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
