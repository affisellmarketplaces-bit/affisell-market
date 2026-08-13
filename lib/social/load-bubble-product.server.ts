import "server-only"

import { buildResellerBoutiquePath } from "@/lib/boutique/reseller-store-slug"
import type { BubbleProductView } from "@/lib/social/bubble-product-types"
import { buildViralMedias } from "@/lib/social/build-viral-medias"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { isLocalhostHost } from "@/lib/localhost-host"
import { prisma } from "@/lib/prisma"
import { resolvePublicAppUrl } from "@/lib/public-app-url"

/** Local Next always speaks HTTP — never emit https://localhost (Chrome SSL protocol error). */
function bubbleAppOrigin(): string {
  const origin = resolvePublicAppUrl().replace(/\/$/, "")
  try {
    const u = new URL(origin)
    if (isLocalhostHost(u.hostname)) {
      u.protocol = "http:"
      return u.origin
    }
    return u.origin
  } catch {
    return origin.startsWith("http") ? origin : `http://${origin}`
  }
}

function bubbleHostLabel(appUrl: string): string {
  try {
    return new URL(appUrl).host
  } catch {
    return appUrl.replace(/^https?:\/\//, "")
  }
}

type ListingRow = {
  id: string
  sellingPriceCents: number
  customTitle: string | null
  customImages: string[]
}

async function resolveAffiliateListing(args: {
  productOrListingId: string
  affiliateId?: string | null
}): Promise<{ productId: string; listing: ListingRow | null } | null> {
  const id = args.productOrListingId.trim()
  if (!id) return null

  if (args.affiliateId) {
    const ownedListing = await prisma.affiliateProduct.findFirst({
      where: {
        affiliateId: args.affiliateId,
        OR: [{ id }, { productId: id }],
        isListed: true,
      },
      select: {
        id: true,
        productId: true,
        sellingPriceCents: true,
        customTitle: true,
        customImages: true,
        product: { select: { id: true, active: true } },
      },
      orderBy: { updatedAt: "desc" },
    })
    if (ownedListing?.product.active) {
      return {
        productId: ownedListing.productId,
        listing: {
          id: ownedListing.id,
          sellingPriceCents: ownedListing.sellingPriceCents,
          customTitle: ownedListing.customTitle,
          customImages: ownedListing.customImages,
        },
      }
    }
  }

  const product = await prisma.product.findFirst({
    where: { id, active: true },
    select: { id: true },
  })
  if (!product) return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      productId: product.id,
      isListed: true,
      ...(args.affiliateId ? { affiliateId: args.affiliateId } : {}),
    },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
    },
    orderBy: args.affiliateId ? { updatedAt: "desc" } : { conversions: "desc" },
  })

  return {
    productId: product.id,
    listing,
  }
}

/**
 * Bubble / viral product view.
 * When `affiliateId` is set (reseller dashboard), prices come from that affiliate's listing only.
 */
export async function loadBubbleProductView(
  productOrListingId: string,
  affiliateId?: string | null
): Promise<BubbleProductView | null> {
  const resolved = await resolveAffiliateListing({ productOrListingId, affiliateId })
  if (!resolved) return null

  const product = await prisma.product.findFirst({
    where: { id: resolved.productId, active: true },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      compareAt: true,
      deliveryDays: true,
      shippingCountry: true,
      videoAdUrl: true,
      descriptionIllustrationVideos: true,
      videos: { select: { videoUrl: true }, take: 1 },
      supplier: {
        select: {
          trustScore: true,
        },
      },
    },
  })
  if (!product) return null

  const listing = resolved.listing
  const store =
    affiliateId != null
      ? await prisma.store.findUnique({
          where: { userId: affiliateId },
          select: { slug: true, name: true },
        })
      : null

  const cost = product.basePriceCents / 100
  const saleFromListing = listing ? listing.sellingPriceCents / 100 : null
  const sale = saleFromListing ?? psychologicalPrice(cost * 3.2)
  const marginEuro = Math.max(0, Math.round((sale - cost) * 100) / 100)
  const imageUrl =
    listing?.customImages?.[0]?.trim() ||
    product.images.find((u) => u?.startsWith("http")) ||
    product.images[0] ||
    null

  const medias = buildViralMedias({
    images: product.images,
    customImages: listing?.customImages,
    videoUrl: product.videos[0]?.videoUrl ?? null,
    videoAdUrl: product.videoAdUrl,
    illustrationVideos: product.descriptionIllustrationVideos,
  })

  const appUrl = bubbleAppOrigin()
  const storeSlug = store?.slug?.trim() || null
  const boutiquePath =
    listing?.id && storeSlug ? buildResellerBoutiquePath(storeSlug, listing.id) : null
  const boutiqueUrl = boutiquePath ? `${appUrl}${boutiquePath}` : null

  return {
    id: product.id,
    title: listing?.customTitle?.trim() || product.name,
    imageUrl,
    medias,
    salePrice: sale,
    compareAtPrice: product.compareAt != null ? Number(product.compareAt) : null,
    costPrice: cost,
    marginEuro,
    deliveryDays: product.deliveryDays ?? 5,
    deliveryCountry: product.shippingCountry?.trim().toUpperCase() || "FR",
    supplierTrustScore: product.supplier.trustScore ?? 75,
    supplierName: null,
    listingId: listing?.id ?? null,
    bubbleUrl: `${appUrl}/product/${product.id}/bubble`,
    storeSlug,
    storeName: store?.name?.trim() || null,
    boutiqueUrl,
    boutiqueHostLabel: boutiquePath && storeSlug ? `${bubbleHostLabel(appUrl)}/boutique/${storeSlug}` : null,
  }
}
