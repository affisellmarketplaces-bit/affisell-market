import { cache } from "react"

import {
  listingDisplayDescription,
  listingDisplayTitle,
  listingPrimaryImageUrl,
} from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { buildProductListingMetadata } from "@/lib/product-listing-seo"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"
import type { Metadata } from "next"

const seoSelect = {
  sellingPriceCents: true,
  customTitle: true,
  customImages: true,
  customDescription: true,
  seoTitle: true,
  seoDescription: true,
  customSlug: true,
  product: {
    select: {
      name: true,
      description: true,
      images: true,
      stock: true,
    },
  },
} as const

async function findListingSeoRow(listingId: string, storeSlug?: string) {
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
    select: seoSelect,
  })
  if (listing) return listing
  if (!storeSlug) return null
  return prisma.affiliateProduct.findFirst({
    where: {
      id: listingId,
      isListed: true,
      product: buyerMarketplaceProductWhere,
      affiliate: { role: "AFFILIATE" },
    },
    select: seoSelect,
  })
}

/** Request-deduped SEO row (metadata + page share one query). */
export const loadListingSeoRowCached = cache(findListingSeoRow)

export async function buildListingMetadataForId(
  listingId: string,
  storeSlug?: string
): Promise<Metadata> {
  const resolved = await loadListingSeoRowCached(listingId, storeSlug)
  if (!resolved?.product) return { title: "Produit" }
  const name =
    resolved.seoTitle?.trim() || listingDisplayTitle(resolved.customTitle, resolved.product.name)
  const imageUrl =
    listingPrimaryImageUrl(resolved.customImages, resolved.product.images) || null
  const metadata = buildProductListingMetadata({
    name,
    description:
      resolved.seoDescription?.trim() ||
      listingDisplayDescription(resolved.customDescription, resolved.product.description),
    imageUrl,
    priceCents: resolved.sellingPriceCents,
    inStock: resolved.product.stock > 0,
    customerFacing: true,
  })

  if (storeSlug) {
    const canonical = `${resolveSiteBaseUrl()}${shopListingPath(
      storeSlug,
      listingId,
      resolved.customSlug
    )}`
    return {
      ...metadata,
      alternates: { canonical },
      openGraph: {
        ...metadata.openGraph,
        url: canonical,
      },
    }
  }

  return metadata
}
