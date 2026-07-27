import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { ensureGhostStockSchema } from "@/lib/ghost/ensure-ghost-schema"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"
import { getSiteUrl } from "@/lib/site-url"
import { getStripeClient } from "@/lib/stripe"
import { stripeProductImages } from "@/lib/product-images"

function baseUrl(): string {
  return getSiteUrl()
}

async function loadAgentListing(productId: string) {
  await ensureGhostStockSchema()
  const byAffiliateId = {
    id: productId,
    ...buyerListedAffiliateProductWhere,
  }
  const byProductId = {
    productId,
    ...buyerListedAffiliateProductWhere,
  }

  const findFull = async () =>
    (await prisma.affiliateProduct.findFirst({
      where: byAffiliateId,
      include: { product: true },
    })) ??
    (await prisma.affiliateProduct.findFirst({
      where: byProductId,
      include: { product: true },
      orderBy: { id: "asc" },
    }))

  try {
    return await findFull()
  } catch (error: unknown) {
    if (!isPrismaMissingColumnError(error)) throw error
    console.log("[agent-checkout]", {
      result: "ghost_p2022_retry",
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    await ensureGhostStockSchema({ force: true })
    try {
      return await findFull()
    } catch (retryError: unknown) {
      if (!isPrismaMissingColumnError(retryError)) throw retryError
      console.log("[agent-checkout]", {
        result: "ghost_select_fallback",
        productId,
        error: retryError instanceof Error ? retryError.message : String(retryError),
      })
      const productSelect = {
        id: true,
        name: true,
        images: true,
      } as const
      return (
        (await prisma.affiliateProduct.findFirst({
          where: byAffiliateId,
          select: {
            id: true,
            productId: true,
            sellingPriceCents: true,
            customTitle: true,
            customImages: true,
            product: { select: productSelect },
          },
        })) ??
        (await prisma.affiliateProduct.findFirst({
          where: byProductId,
          select: {
            id: true,
            productId: true,
            sellingPriceCents: true,
            customTitle: true,
            customImages: true,
            product: { select: productSelect },
          },
          orderBy: { id: "asc" },
        }))
      )
    }
  }
}

export async function createCheckoutSession(productId: string, userId?: string) {
  const stripe = getStripeClient()
  const id = productId.trim()
  if (!id) return null

  const listing = await loadAgentListing(id)

  if (!listing) return null

  const name = listingDisplayTitle(listing.customTitle, listing.product.name)
  const images = stripeProductImages(listingGalleryUrls(listing.customImages, listing.product.images)) ?? []
  const unitAmount = listing.sellingPriceCents
  const root = baseUrl()

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name, images },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    success_url: `${root}/agent?success=true`,
    cancel_url: `${root}/agent`,
    metadata: {
      source: "agent",
      affiliateProductId: listing.id,
      productId: listing.productId,
      userId: userId ?? "",
    },
  })

  await prisma.affisellTrackEvent.create({
    data: {
      eventType: "checkout_initiated",
      productId: listing.productId,
      userId: userId ?? undefined,
    },
  })

  if (!session.url) return null

  return {
    checkoutUrl: session.url,
    listingId: listing.id,
    productId: listing.productId,
    name,
    priceCents: unitAmount,
  }
}
