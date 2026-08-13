import { randomUUID } from "crypto"

import type Stripe from "stripe"

import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import {
  lookupVariantPricingEntry,
  parseAffiliateVariantPricingJson,
} from "@/lib/affiliate-variant-pricing"
import { resolveAffisellCommissionRateBpsForProductId } from "@/lib/affisell-platform-commission.server"
import { appBaseUrl } from "@/lib/app-base-url"
import {
  loadResellerStorefrontProduct,
  resolveResellerDefaultListingCommerce,
} from "@/lib/boutique/load-reseller-storefront.server"
import { normalizeCartVariantSignature } from "@/lib/cart-variant"
import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { marketplaceCheckoutPaymentSessionOptionsForAmount } from "@/lib/marketplace-checkout-payment-methods"
import {
  buildHtLineItem,
  marketplaceCheckoutCgvConsentOptions,
  marketplaceCheckoutTaxOptions,
  type MarketplaceStripeLineItem,
} from "@/lib/marketplace-stripe-checkout"
import { prisma } from "@/lib/prisma"
import { stripeProductImages } from "@/lib/product-images"
import { variantsFromDb } from "@/lib/product-variants"
import { resolveSupplierCommissionRateBpsForProductId } from "@/lib/supplier-commission-rate.server"
import {
  AFFILIATE_COMMISSION_REQUIRED_ERROR,
  productHasExplicitSupplierCommission,
} from "@/lib/supplier-explicit-commission"
import { intersectProductDeliveryCountries } from "@/lib/supplier-delivery-countries"
import { splitVariantLineName } from "@/lib/supplier-sku-builder"
import { getStripeClient } from "@/lib/stripe"
import { isStripeCheckoutPaidTotalValid } from "@/lib/stripe-minimum"

export type CreateResellerOrderInput = {
  storeSlug: string
  productId: string
  customerEmail?: string | null
}

export type CreateResellerOrderResult =
  | {
      success: true
      orderId: string
      checkoutUrl: string
      marginCents: number
      sellingPriceCents: number
    }
  | {
      success: false
      error: string
    }

type StripeCheckoutAllowedCountries = NonNullable<
  NonNullable<
    Parameters<InstanceType<typeof Stripe>["checkout"]["sessions"]["create"]>[0]
  >["shipping_address_collection"]
>["allowed_countries"]

function resolveWholesalePriceCents(args: {
  sellingPriceCents: number
  defaultOptionName: string | null
  variantPricingRaw: unknown
  productBasePriceCents: number
  activeVariantWholesaleCents: number | null
}): number {
  const variantPricing = parseAffiliateVariantPricingJson(args.variantPricingRaw)
  const pricingEntry = lookupVariantPricingEntry(variantPricing, args.defaultOptionName)
  if (pricingEntry?.marginCents != null && pricingEntry.marginCents >= 0) {
    return Math.max(0, args.sellingPriceCents - pricingEntry.marginCents)
  }
  if (args.activeVariantWholesaleCents != null && args.activeVariantWholesaleCents > 0) {
    return args.activeVariantWholesaleCents
  }
  return Math.max(0, args.productBasePriceCents)
}

async function resolveResellerCheckoutCountries(
  deliveryCountryCodes: string[]
): Promise<string[]> {
  const platform = await resolveStripeCheckoutAllowedCountries()
  if (deliveryCountryCodes.length === 0) return platform
  return intersectProductDeliveryCountries(
    [{ deliveryCountryCodes }],
    platform
  )
}

function buildResellerStripeLineItem(args: {
  title: string
  customImages: string[]
  productImages: string[]
  sellingPriceCents: number
  variantLabel: string | null
}): MarketplaceStripeLineItem {
  const variantSuffix = args.variantLabel?.trim() ? ` · ${args.variantLabel.trim()}` : ""
  const displayName = `${args.title}${variantSuffix}`
  const gallery = listingGalleryUrls(args.customImages, args.productImages)
  const images = stripeProductImages(gallery) ?? []
  return buildHtLineItem({
    name: displayName,
    images,
    linePaidCentsHt: args.sellingPriceCents,
    qty: 1,
  })
}

export async function createResellerOrder(
  input: CreateResellerOrderInput
): Promise<CreateResellerOrderResult> {
  const storeSlug = input.storeSlug?.trim()
  const productId = input.productId?.trim()
  if (!storeSlug || !productId) {
    return { success: false, error: "missing_fields" }
  }

  const storefront = await loadResellerStorefrontProduct(productId)
  if (!storefront) {
    return { success: false, error: "listing_not_found" }
  }
  if (storefront.isOutOfStock) {
    return { success: false, error: "out_of_stock" }
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: productId,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      customTitle: true,
      customImages: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      marginCents: true,
      affiliateId: true,
      affiliate: {
        select: {
          id: true,
          stripeAccountId: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          active: true,
          supplierId: true,
          basePriceCents: true,
          stock: true,
          variants: true,
          colors: true,
          customColumns: true,
          listingKind: true,
          deliveryCountryCodes: true,
          commissionRate: true,
          offerMode: true,
          productVariants: {
            select: {
              id: true,
              color: true,
              size: true,
              stock: true,
              customData: true,
              supplierPrice: true,
              wholesalePriceCents: true,
            },
          },
        },
      },
    },
  })

  if (!listing?.product || !listing.affiliate) {
    return { success: false, error: "listing_not_found" }
  }
  if (!listing.product.active || !listing.product.supplierId) {
    return { success: false, error: "listing_not_found" }
  }

  const commerce = resolveResellerDefaultListingCommerce({
    listingSellingPriceCents: listing.sellingPriceCents,
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: {
      basePriceCents: listing.product.basePriceCents,
      stock: listing.product.stock,
      variants: listing.product.variants,
      colors: listing.product.colors ?? [],
      customColumns: listing.product.customColumns,
      productVariants: listing.product.productVariants ?? [],
    },
  })

  if (commerce.availableStock <= 0) {
    return { success: false, error: "out_of_stock" }
  }

  if (
    !productHasExplicitSupplierCommission({
      commissionRate: listing.product.commissionRate,
      variants: listing.product.variants,
      offerMode: listing.product.offerMode,
      optionName: commerce.defaultOptionName,
    })
  ) {
    console.log("[reseller-order]", {
      storeSlug,
      productId,
      result: "commission_required",
      error: AFFILIATE_COMMISSION_REQUIRED_ERROR,
    })
    return { success: false, error: AFFILIATE_COMMISSION_REQUIRED_ERROR }
  }

  const sellingPriceCents = commerce.priceCents
  if (!isStripeCheckoutPaidTotalValid(sellingPriceCents)) {
    return { success: false, error: "stripe_minimum_not_met" }
  }

  const parsedVariants = variantsFromDb(listing.product.variants)
  const activeVariantRow = commerce.defaultOptionName
    ? parsedVariants?.variantRows?.find(
        (row) => row.name.trim().toLowerCase() === commerce.defaultOptionName!.trim().toLowerCase()
      )
    : undefined

  const wholesalePriceCents = resolveWholesalePriceCents({
    sellingPriceCents,
    defaultOptionName: commerce.defaultOptionName,
    variantPricingRaw: listing.variantPricing,
    productBasePriceCents: listing.product.basePriceCents,
    activeVariantWholesaleCents: activeVariantRow?.priceCents ?? null,
  })

  const marginCents = Math.max(0, sellingPriceCents - wholesalePriceCents)
  const checkoutVariantLabel = commerce.defaultOptionName?.trim() || null
  const variantParts = checkoutVariantLabel
    ? splitVariantLineName(checkoutVariantLabel)
    : { color: "", size: null as string | null }
  const checkoutVariantSignature = normalizeCartVariantSignature(
    variantParts.color,
    variantParts.size
  )

  const [affisellCommissionRateBps, supplierCommissionRateBps] = await Promise.all([
    resolveAffisellCommissionRateBpsForProductId(listing.product.id),
    resolveSupplierCommissionRateBpsForProductId({
      productId: listing.product.id,
      optionName: checkoutVariantLabel,
      variants: parsedVariants,
    }),
  ])

  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      currency: "eur",
      productId: listing.product.id,
      supplierId: listing.product.supplierId,
      affiliateId: listing.affiliate.id,
      affiliateProductId: listing.id,
      quantity: 1,
      customerEmail: input.customerEmail?.trim() || "",
      buyerLocale: "fr",
      shippingAddress: { resellerStoreSlug: storeSlug },
      stripeSessionId: `pending_${randomUUID()}`,
      basePriceCents: wholesalePriceCents,
      sellingPriceCents,
      commissionCents: 0,
      marginCents,
      affiliatePayoutCents: 0,
      variantLabel: checkoutVariantLabel,
      supplierPriceCents: wholesalePriceCents,
      supplierCommissionRateBps,
      affiliateMarginCents: marginCents,
      affisellCommissionRateBps,
      affiliateStripeAccountId: listing.affiliate.stripeAccountId,
      paymentSettlementStatus: "PENDING",
      listingKindSnapshot: listing.product.listingKind.trim().toUpperCase(),
    },
  })

  const allowedCountries = await resolveResellerCheckoutCountries(
    listing.product.deliveryCountryCodes ?? []
  )
  if (allowedCountries.length === 0) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    return { success: false, error: "delivery_destination_unavailable" }
  }

  let stripe: ReturnType<typeof getStripeClient>
  try {
    stripe = getStripeClient()
  } catch {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    return { success: false, error: "stripe_unavailable" }
  }

  const baseUrl = appBaseUrl().replace(/\/$/, "")
  const cancelUrl = `${baseUrl}/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(productId)}`
  const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`
  const paymentMethodTypes =
    marketplaceCheckoutPaymentSessionOptionsForAmount(sellingPriceCents).payment_method_types

  const lineItems: MarketplaceStripeLineItem[] = [
    buildResellerStripeLineItem({
      title: listingDisplayTitle(listing.customTitle, listing.product.name),
      customImages: listing.customImages,
      productImages: listing.product.images ?? [],
      sellingPriceCents,
      variantLabel: checkoutVariantLabel,
    }),
  ]

  let checkoutSession: Stripe.Checkout.Session
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: lineItems,
      ...marketplaceCheckoutTaxOptions(),
      ...marketplaceCheckoutCgvConsentOptions(),
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_creation: "always",
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: allowedCountries as StripeCheckoutAllowedCountries,
      },
      phone_number_collection: { enabled: true },
      payment_intent_data: {
        metadata: {
          flow: "marketplace",
          sellerId: listing.product.supplierId,
          orderId: order.id,
          productId: listing.product.id,
          affiliateProductId: listing.id,
          resellerStoreSlug: storeSlug,
        },
      },
      metadata: {
        flow: "marketplace",
        orderId: order.id,
        productId: listing.product.id,
        affiliateProductId: listing.id,
        supplierId: listing.product.supplierId,
        sellerId: listing.product.supplierId,
        affiliateId: listing.affiliate.id,
        checkoutQty: "1",
        checkoutVariantLabel: checkoutVariantLabel ?? "",
        checkoutVariantSignature,
        linePaids: JSON.stringify([sellingPriceCents]),
        locale: "fr",
        cgvConsentRequired: "1",
        resellerStoreSlug: storeSlug,
        resellerCheckout: "1",
      },
    })
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    console.log("[reseller-order]", {
      storeSlug,
      productId,
      orderId: order.id,
      result: "stripe_session_failed",
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: "stripe_session_failed" }
  }

  if (!checkoutSession.url) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    return { success: false, error: "stripe_url_unavailable" }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: checkoutSession.id },
  })

  console.log("[reseller-order]", {
    storeSlug,
    productId,
    orderId: order.id,
    stripeSessionId: checkoutSession.id,
    sellingPriceCents,
    marginCents,
    result: "checkout_ready",
  })

  return {
    success: true,
    orderId: order.id,
    checkoutUrl: checkoutSession.url,
    marginCents,
    sellingPriceCents,
  }
}
