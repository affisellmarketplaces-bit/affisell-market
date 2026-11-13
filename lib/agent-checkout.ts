import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { evaluateCheckoutStockGate } from "@/lib/checkout-stock"
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

const agentListingSelect = {
  id: true,
  productId: true,
  sellingPriceCents: true,
  customTitle: true,
  customImages: true,
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      // Same stock gate as the marketplace checkout: the paid session reaches the stock decrement of the fulfilment.
      stock: true,
      variants: true,
      hasVariants: true,
      listingKind: true,
    },
  },
} as const

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

  const findSafe = async () =>
    (await prisma.affiliateProduct.findFirst({
      where: byAffiliateId,
      select: agentListingSelect,
    })) ??
    (await prisma.affiliateProduct.findFirst({
      where: byProductId,
      select: agentListingSelect,
      orderBy: { id: "asc" },
    }))

  try {
    return await findSafe()
  } catch (error: unknown) {
    if (!isPrismaMissingColumnError(error)) throw error
    console.log("[agent-checkout]", {
      result: "ghost_p2022_retry",
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    await ensureGhostStockSchema({ force: true })
    return findSafe()
  }
}

export type AgentCheckoutResult =
  | { checkoutUrl: string; listingId: string; productId: string; name: string; priceCents: number }
  | { checkoutUrl: null; reason: "out_of_stock"; name: string }

export async function createCheckoutSession(productId: string, userId?: string): Promise<AgentCheckoutResult | null> {
  const stripe = getStripeClient()
  const id = productId.trim()
  if (!id) return null

  const listing = await loadAgentListing(id)

  if (!listing) return null

  const name = listingDisplayTitle(listing.customTitle, listing.product.name)

  // One unit, no variant selection: a product the stock can not serve never gets a payment session (enforce mode).
  const stockGate = evaluateCheckoutStockGate([
    {
      productId: listing.productId,
      productName: listing.product.name,
      listingKind: listing.product.listingKind,
      stock: listing.product.stock,
      variants: listing.product.variants,
      hasVariants: listing.product.hasVariants,
      variantSignature: "",
      qty: 1,
    },
  ])
  if (stockGate.refuse) return { checkoutUrl: null, reason: "out_of_stock", name }

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
