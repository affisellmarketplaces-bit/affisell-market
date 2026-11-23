import { isPricedBelowSupplierPrice } from "@/lib/checkout-price-guard"
import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { evaluateCheckoutStockGate } from "@/lib/checkout-stock"
import { requiresVariantChoice } from "@/lib/variant-selection"
import { evaluateExternalPurchaseCheckoutGate } from "@/lib/procurement/external-purchase-checkout.server"
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
      customColumns: true,
      // Variants kept in the separate table: judged with the same rule as the advanced rows (never decremented here).
      productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
      listingKind: true,
      basePriceCents: true,
      supplierId: true,
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
  | { checkoutUrl: null; reason: "out_of_stock" | "price_updating"; name: string }
  | { checkoutUrl: null; reason: "variant_choice_required"; name: string; productPath: string }

export async function createCheckoutSession(
  productId: string,
  userId?: string,
  opts: { analyticsConsent?: boolean } = {},
): Promise<AgentCheckoutResult | null> {
  const stripe = getStripeClient()
  const id = productId.trim()
  if (!id) return null

  const listing = await loadAgentListing(id)

  if (!listing) return null

  const name = listingDisplayTitle(listing.customTitle, listing.product.name)

  // The assistant buys one unit WITHOUT a size / colour. A product that needs one is never bought undetermined — in
  // every mode, like the card buttons (it is a missing choice, not a stock refusal): the shopper gets its page to
  // choose (shared rule, lib/variant-selection.ts) — advanced rows or, when there are none, the variant table.
  if (
    (listing.product.listingKind ?? "PHYSICAL").trim().toUpperCase() === "PHYSICAL" &&
    requiresVariantChoice({
      variants: listing.product.variants,
      customColumns: listing.product.customColumns,
      tableVariants: listing.product.productVariants ?? [],
    })
  ) {
    return { checkoutUrl: null, reason: "variant_choice_required", name, productPath: `/marketplace/${encodeURIComponent(listing.id)}` }
  }

  // One unit, no variant selection: a product the stock can not serve never gets a payment session (enforce mode).
  const stockGate = evaluateCheckoutStockGate([
    {
      productId: listing.productId,
      productName: listing.product.name,
      listingKind: listing.product.listingKind,
      stock: listing.product.stock,
      variants: listing.product.variants,
      hasVariants: listing.product.hasVariants,
      customColumns: listing.product.customColumns,
      tableVariants: listing.product.productVariants ?? null,
      variantSignature: "",
      qty: 1,
    },
  ])
  if (stockGate.refuseVariant) {
    return { checkoutUrl: null, reason: "variant_choice_required", name, productPath: `/marketplace/${encodeURIComponent(listing.id)}` }
  }
  if (stockGate.refuse) return { checkoutUrl: null, reason: "out_of_stock", name }

  // Single external-purchase switch: a product only an external purchase can deliver (warn by default, see the module).
  const purchaseGate = await evaluateExternalPurchaseCheckoutGate([
    { productId: listing.productId, productName: listing.product.name, supplierId: listing.product.supplierId },
  ])
  if (purchaseGate.refuse) return { checkoutUrl: null, reason: "out_of_stock", name }

  // Never below the supplier's current price (lib/checkout-price-guard.ts): nobody could be paid for that sale.
  if (isPricedBelowSupplierPrice({ unitSellingCents: listing.sellingPriceCents, unitSupplierCents: listing.product.basePriceCents })) {
    console.warn("[agent-checkout]", { result: "refused_price_below_supplier_price", listingId: listing.id })
    return { checkoutUrl: null, reason: "price_updating", name }
  }

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

  // Legacy behavioural row: only with analytics consent (D1), and without the buyer's account id (no reader uses it).
  if (opts.analyticsConsent === true) {
    await prisma.affisellTrackEvent.create({
      data: {
        eventType: "checkout_initiated",
        productId: listing.productId,
      },
    })
  }

  if (!session.url) return null

  return {
    checkoutUrl: session.url,
    listingId: listing.id,
    productId: listing.productId,
    name,
    priceCents: unitAmount,
  }
}
