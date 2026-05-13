import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { stripeProductImages } from "@/lib/product-images"

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "")
}

export async function createCheckoutSession(productId: string, userId?: string) {
  const stripe = getStripeClient()
  const id = productId.trim()
  if (!id) return null

  const listing =
    (await prisma.affiliateProduct.findFirst({
      where: {
        id,
        isListed: true,
        product: { active: true },
        ...affiliateRoleMarketplaceWhere,
      },
      include: { product: true },
    })) ??
    (await prisma.affiliateProduct.findFirst({
      where: {
        productId: id,
        isListed: true,
        product: { active: true },
        ...affiliateRoleMarketplaceWhere,
      },
      include: { product: true },
      orderBy: { id: "asc" },
    }))

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
