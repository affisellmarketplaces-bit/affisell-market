import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import {
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { auth } from "@/auth"
import {
  formatCartVariantLabel,
  normalizeCartVariantSignature,
  parseCartVariantSignature,
} from "@/lib/cart-variant"
import { resolveAffisellCommissionRateBpsForProductId } from "@/lib/affisell-platform-commission.server"
import { resolveSupplierCommissionRateBpsForProductId } from "@/lib/supplier-commission-rate.server"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import {
  fixZeroPaidLinesCents,
  isStripeCheckoutPaidTotalValid,
  proportionalLinePaidsCents,
  STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
  stripeCheckoutMinimumNotMetResponse,
  sumPaidLinesCents,
} from "@/lib/marketplace-checkout-discount"
import { prisma } from "@/lib/prisma"
import {
  marketplaceSellingPriceCentsForOption,
  marketplaceWholesaleCentsForOption,
  variantsFromDb,
} from "@/lib/product-variants"
import { stripeProductImages } from "@/lib/product-images"
import { resolveCheckoutBaseUrl } from "@/lib/checkout-base-url"
import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import {
  isDonationListing,
  parseProductOfferMode,
  resolvePurchaseMinQty,
} from "@/lib/product-offer-mode"
import { isBookingCheckoutBlocked } from "@/lib/booking/checkout-live"
import {
  validateBookableListingCheckout,
  validateBookingCartLine,
} from "@/lib/booking/checkout-validation"
import { resolveSeatLayoutConfig } from "@/lib/booking/seat-layout"
import { computeBookingLineSubtotalCents } from "@/lib/booking/seat-pricing"
import { reserveBookingSlotHoldInTransaction } from "@/lib/booking/slot-hold"
import { marketplaceCheckoutPaymentSessionOptions } from "@/lib/marketplace-checkout-payment-methods"
import {
  buildHtLineItem,
  marketplaceCheckoutTaxOptions,
  type MarketplaceStripeLineItem,
} from "@/lib/marketplace-stripe-checkout"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { getStripeClient } from "@/lib/stripe"
import type Stripe from "stripe"

type StripeCheckoutAllowedCountries = NonNullable<
  NonNullable<
    Parameters<InstanceType<typeof Stripe>["checkout"]["sessions"]["create"]>[0]
  >["shipping_address_collection"]
>["allowed_countries"]

function checkoutBaseUrls(
  body: { cancelPath?: string; successPath?: string },
  request?: Request
) {
  const baseUrl = resolveCheckoutBaseUrl(request)

  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/") ? body.cancelPath : "/"

  const defaultSuccess = "/success?session_id={CHECKOUT_SESSION_ID}"
  const successPath =
    typeof body.successPath === "string" && body.successPath.startsWith("/")
      ? body.successPath
      : defaultSuccess

  return { baseUrl, cancelPath, successPath }
}

type CartLineInput = {
  productId?: string
  qty?: number
  variantSignature?: string
  selectedColor?: string | null
  selectedSize?: string | null
}

function resolveCheckoutVariantLabel(row: CartLineInput): string {
  const explicit = formatCartVariantLabel(row.selectedColor, row.selectedSize)
  if (explicit) return explicit
  const raw = typeof row.variantSignature === "string" ? row.variantSignature.trim() : ""
  if (!raw) return ""
  const p = parseCartVariantSignature(raw)
  return formatCartVariantLabel(p.color, p.size)
}

function checkoutOptionName(row: CartLineInput): string | null {
  const color = typeof row.selectedColor === "string" ? row.selectedColor.trim() : ""
  if (color) return color
  const raw = typeof row.variantSignature === "string" ? row.variantSignature.trim() : ""
  if (!raw) return null
  return parseCartVariantSignature(raw).color || null
}

function lineSellingPriceCents(
  listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>,
  row: CartLineInput
): number {
  const variants = variantsFromDb(listing.product.variants)
  return marketplaceSellingPriceCentsForOption({
    listingSellingPriceCents: listing.sellingPriceCents,
    productBasePriceCents: listing.product.basePriceCents,
    variants,
    optionName: checkoutOptionName(row),
  })
}

function validateOfferCheckoutLine(
  listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>,
  qty: number,
  lineSubtotalCents: number
): NextResponse | null {
  const offerMode = parseProductOfferMode(listing.product.offerMode)
  const minQty = resolvePurchaseMinQty(offerMode, listing.product.minOrderQuantity)
  if (qty < minQty) {
    return NextResponse.json(
      {
        error: "wholesale_moq_not_met",
        minOrderQuantity: minQty,
      },
      { status: 400 }
    )
  }
  if (isDonationListing(offerMode, lineSubtotalCents)) {
    return NextResponse.json(
      { error: "donation_requires_contact" },
      { status: 400 }
    )
  }
  const cartBlock = validateBookingCartLine(listing.product)
  if (cartBlock) return cartBlock
  if (isBookingCheckoutBlocked(listing.product.listingKind)) {
    return NextResponse.json({ error: "booking_checkout_coming_soon" }, { status: 409 })
  }
  return null
}

async function loadListing(id: string) {
  return prisma.affiliateProduct.findFirst({
    where: {
      id,
      ...buyerListedAffiliateProductWhere,
    },
    include: { product: true, affiliate: true },
  })
}

type LoadedLine = {
  affiliateProductId: string
  qty: number
  variantSignature: string
  variantLabel: string
  listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>
}

function pushLineItemsForPaidTotal(
  items: MarketplaceStripeLineItem[],
  listing: LoadedLine["listing"],
  linePaidCents: number,
  qty: number,
  variantLabel: string
) {
  const baseTitle = listingDisplayTitle(listing.customTitle, listing.product.name)
  const variantSuffix = variantLabel.trim() ? ` · ${variantLabel.trim()}` : ""
  const displayName =
    qty > 1 ? `${baseTitle}${variantSuffix} ×${qty}` : `${baseTitle}${variantSuffix}`
  const gallery = listingGalleryUrls(listing.customImages, listing.product.images)
  const images = stripeProductImages(gallery) ?? []
  items.push(
    buildHtLineItem({
      name: displayName,
      images,
      linePaidCentsHt: linePaidCents,
      qty,
    })
  )
}

function computePaidLinesWithReward(args: {
  lineSubtotalsCents: number[]
  balanceCents: number
  requestedRewardCents: number
}): { appliedCents: number; paidLineCents: number[] } {
  const sub = args.lineSubtotalsCents.reduce((a, b) => a + b, 0)
  const maxApply = Math.max(
    0,
    Math.min(args.balanceCents, sub - STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)
  )
  const want = Math.max(0, Math.round(args.requestedRewardCents))
  const applied = Math.min(want, maxApply)
  const targetPaid = sub - applied
  const rawPaid = proportionalLinePaidsCents(args.lineSubtotalsCents, targetPaid)
  const paidLineCents = fixZeroPaidLinesCents(args.lineSubtotalsCents, rawPaid)
  return { appliedCents: applied, paidLineCents }
}

/** Stripe Checkout for multiple marketplace lines (EUR). */
async function checkoutFromItems(
  lines: CartLineInput[],
  opts: { cancelPath?: string; successPath?: string; useRewardCents?: number },
  checkoutLocale: string,
  request: Request
) {
  const stripe = getStripeClient()
  const session = await auth()
  const buyerUserId = session?.user?.id?.trim() || ""

  const normalized: {
    affiliateProductId: string
    qty: number
    variantSignature: string
    variantLabel: string
  }[] = []
  for (const row of lines) {
    const affiliateProductId = typeof row.productId === "string" ? row.productId.trim() : ""
    if (!affiliateProductId) continue
    const qty = Math.max(1, Math.min(99, Math.round(Number(row.qty)) || 1))
    const variantSignature =
      typeof row.variantSignature === "string" && row.variantSignature.trim()
        ? row.variantSignature.trim().slice(0, 200)
        : normalizeCartVariantSignature(row.selectedColor, row.selectedSize)
    const variantLabel = resolveCheckoutVariantLabel(row).slice(0, 200)
    normalized.push({ affiliateProductId, qty, variantSignature, variantLabel })
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 })
  }

  const loaded: LoadedLine[] = []
  for (const row of normalized) {
    const listing = await loadListing(row.affiliateProductId)
    if (!listing || !listing.product.active || !listing.product.supplierId) {
      return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
    }
    const parsed = parseCartVariantSignature(row.variantSignature)
    const unit = lineSellingPriceCents(listing, {
      variantSignature: row.variantSignature,
      selectedColor: parsed.color,
      selectedSize: parsed.size,
    })
    const lineSubtotal = unit * row.qty
    const offerGate = validateOfferCheckoutLine(listing, row.qty, lineSubtotal)
    if (offerGate) return offerGate

    loaded.push({
      affiliateProductId: row.affiliateProductId,
      qty: row.qty,
      variantSignature: row.variantSignature,
      variantLabel: row.variantLabel,
      listing,
    })
  }

  const lineSubtotalsCents = loaded.map((l, i) => {
    const n = normalized[i]!
    const parsed = parseCartVariantSignature(n.variantSignature)
    const unit = lineSellingPriceCents(l.listing, {
      variantSignature: n.variantSignature,
      selectedColor: parsed.color,
      selectedSize: parsed.size,
    })
    return unit * l.qty
  })
  let balanceCents = 0
  if (buyerUserId) {
    const u = await prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { buyerRewardBalanceCents: true },
    })
    balanceCents = u?.buyerRewardBalanceCents ?? 0
  }

  const requestedReward =
    typeof opts.useRewardCents === "number" && Number.isFinite(opts.useRewardCents)
      ? opts.useRewardCents
      : 0

  const { appliedCents, paidLineCents } = computePaidLinesWithReward({
    lineSubtotalsCents,
    balanceCents,
    requestedRewardCents: buyerUserId ? requestedReward : 0,
  })

  for (let i = 0; i < paidLineCents.length; i++) {
    if (lineSubtotalsCents[i]! > 0 && paidLineCents[i]! < 1) {
      return NextResponse.json(
        {
          error:
            "Unable to apply store credit across these lines. Try a smaller amount or fewer items.",
        },
        { status: 400 }
      )
    }
  }

  const paidTotalCents = sumPaidLinesCents(paidLineCents)
  if (!isStripeCheckoutPaidTotalValid(paidTotalCents)) {
    console.log("[checkout]", {
      flow: "cart",
      result: "checkout_minimum_not_met",
      paidTotalCents,
      minAmountCents: STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
    })
    return stripeCheckoutMinimumNotMetResponse()
  }

  const stripeLineItems: MarketplaceStripeLineItem[] = []
  for (let i = 0; i < loaded.length; i++) {
    const row = loaded[i]!
    pushLineItemsForPaidTotal(stripeLineItems, row.listing, paidLineCents[i]!, row.qty, row.variantLabel)
  }

  const supplierIds = [...new Set(loaded.map((l) => l.listing.product.supplierId))]
  const primarySupplierId = supplierIds.length === 1 ? supplierIds[0]! : null

  const { baseUrl, cancelPath, successPath } = checkoutBaseUrls(opts, request)

  const allowedCountries = await resolveStripeCheckoutAllowedCountries()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    ...marketplaceCheckoutPaymentSessionOptions(),
    line_items: stripeLineItems,
    ...marketplaceCheckoutTaxOptions(),
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    customer_creation: "always",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: allowedCountries as StripeCheckoutAllowedCountries,
    },
    phone_number_collection: { enabled: true },
    payment_intent_data: {
      metadata: {
        flow: "marketplace",
        ...(primarySupplierId ? { sellerId: primarySupplierId } : {}),
        ...(buyerUserId ? { buyerUserId } : {}),
      },
    },
    metadata: {
      cartLines: JSON.stringify(normalized),
      appliedRewardCents: String(appliedCents),
      linePaids: JSON.stringify(paidLineCents),
      locale: checkoutLocale,
      ...(primarySupplierId ? { sellerId: primarySupplierId } : {}),
      ...(buyerUserId ? { buyerUserId } : {}),
    },
  })

  console.log("[checkout]", {
    flow: "cart",
    sessionId: checkoutSession.id,
    lineCount: loaded.length,
    baseUrl,
    allowedCountries: allowedCountries.length,
    appliedRewardCents: appliedCents,
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}

/** Stripe Checkout for an AffiliateProduct listing (EUR). */
export async function marketplaceCheckoutPOST(request: Request) {
  const stripe = getStripeClient()
  const checkoutLocale = resolveAppLocale(await resolveRequestLocale(undefined))
  const body = (await request.json().catch(() => ({}))) as {
    affiliateProductId?: string
    productId?: string
    qty?: number
    items?: CartLineInput[]
    cancelPath?: string
    successPath?: string
    useRewardCents?: number
    selectedColor?: string | null
    selectedSize?: string | null
    bookingSlotId?: string | null
    bookingSeatLabels?: string[]
  }

  if (Array.isArray(body.items) && body.items.length > 0) {
    return checkoutFromItems(body.items, body, checkoutLocale, request)
  }

  const affiliateProductId =
    body.affiliateProductId?.trim() || body.productId?.trim() || ""
  if (!affiliateProductId) {
    return NextResponse.json({ error: "Missing affiliateProductId" }, { status: 400 })
  }

  const qty = Math.max(1, Math.min(99, Math.round(Number(body.qty)) || 1))

  const listing = await loadListing(affiliateProductId)

  if (!listing || !listing.product.active || !listing.product.supplierId) {
    return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
  }

  const bookingGate = await validateBookableListingCheckout({
    product: listing.product,
    quantity: qty,
    bookingSlotId: body.bookingSlotId,
    bookingSeatLabels: body.bookingSeatLabels,
  })
  if (bookingGate instanceof NextResponse) return bookingGate
  const resolvedBookingSlotId = bookingGate?.slotId ?? null
  const checkoutQty = bookingGate?.quantity ?? qty
  const checkoutSeatLabels = bookingGate?.seatLabels ?? []

  const product = listing.product
  const affiliateProduct = listing
  const affiliate = listing.affiliate

  const session = await auth()
  const buyerUserId = session?.user?.id?.trim() || ""

  let balanceCents = 0
  if (buyerUserId) {
    const u = await prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { buyerRewardBalanceCents: true },
    })
    balanceCents = u?.buyerRewardBalanceCents ?? 0
  }

  const unitSelling = lineSellingPriceCents(listing, {
    selectedColor: body.selectedColor,
    selectedSize: body.selectedSize,
  })
  const pricing = computeBookingLineSubtotalCents({
    unitSellingCents: unitSelling,
    quantity: checkoutQty,
    seatLabels: checkoutSeatLabels,
    listingKind: product.listingKind,
    seatLayout: resolveSeatLayoutConfig(product.bookingSeatLayout, product.listingKind),
  })
  const lineSubtotal = pricing.lineSubtotalCents
  if (pricing.vipSurchargeTotalCents > 0) {
    console.log("[booking]", {
      result: "vip_surcharge_applied",
      affiliateProductId,
      vipSeatCount: pricing.vipSeatCount,
      vipSurchargeTotalCents: pricing.vipSurchargeTotalCents,
    })
  }
  const offerGate = validateOfferCheckoutLine(listing, checkoutQty, lineSubtotal)
  if (offerGate) return offerGate
  const requestedReward =
    typeof body.useRewardCents === "number" && Number.isFinite(body.useRewardCents)
      ? body.useRewardCents
      : 0

  const { appliedCents, paidLineCents } = computePaidLinesWithReward({
    lineSubtotalsCents: [lineSubtotal],
    balanceCents,
    requestedRewardCents: buyerUserId ? requestedReward : 0,
  })

  if (lineSubtotal > 0 && paidLineCents[0]! < 1) {
    return NextResponse.json(
      { error: "Unable to apply this much store credit for this item." },
      { status: 400 }
    )
  }

  const paidTotalCents = sumPaidLinesCents(paidLineCents)
  if (!isStripeCheckoutPaidTotalValid(paidTotalCents)) {
    console.log("[checkout]", {
      flow: "single",
      result: "checkout_minimum_not_met",
      paidTotalCents,
      minAmountCents: STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
      affiliateProductId,
    })
    return stripeCheckoutMinimumNotMetResponse()
  }

  const stripeLineItems: MarketplaceStripeLineItem[] = []
  const oneShotVariantLabel = resolveCheckoutVariantLabel({
    selectedColor: body.selectedColor,
    selectedSize: body.selectedSize,
  })
  const oneShotVariantSignature = normalizeCartVariantSignature(body.selectedColor, body.selectedSize)
  pushLineItemsForPaidTotal(stripeLineItems, listing, paidLineCents[0]!, checkoutQty, oneShotVariantLabel)

  const variants = variantsFromDb(product.variants)
  const optionName = checkoutOptionName({
    selectedColor: body.selectedColor,
    selectedSize: body.selectedSize,
  })
  const unitSupplierCents = marketplaceWholesaleCentsForOption({
    productBasePriceCents: product.basePriceCents,
    variants,
    optionName,
  })
  const supplierPriceCents = unitSupplierCents * checkoutQty
  const sellingPriceCents = paidLineCents[0]!
  const unitMarginCents =
    affiliateProduct.marginCents > 0
      ? affiliateProduct.marginCents
      : Math.max(0, unitSelling - unitSupplierCents)
  const lineMarginCents = Math.max(0, sellingPriceCents - supplierPriceCents)
  const affisellCommissionRateBps = await resolveAffisellCommissionRateBpsForProductId(product.id)
  const supplierCommissionRateBps = await resolveSupplierCommissionRateBpsForProductId({
    productId: product.id,
    optionName,
    variants,
  })

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        status: "PENDING",
        currency: "eur",
        productId: product.id,
        supplierId: product.supplierId,
        affiliateId: affiliate.id,
        affiliateProductId: affiliateProduct.id,
        quantity: checkoutQty,
        customerEmail: "",
        buyerLocale: checkoutLocale,
        shippingAddress: {},
        stripeSessionId: `pending_${randomUUID()}`,
        basePriceCents: supplierPriceCents,
        sellingPriceCents,
        commissionCents: 0,
        marginCents: lineMarginCents,
        affiliatePayoutCents: 0,
        variantLabel: oneShotVariantLabel || null,
        supplierPriceCents: unitSupplierCents * checkoutQty,
        supplierCommissionRateBps,
        affiliateMarginCents:
          affiliateProduct.marginCents > 0
            ? affiliateProduct.marginCents * checkoutQty
            : unitMarginCents * checkoutQty,
        affisellCommissionRateBps,
        affiliateStripeAccountId: affiliate.stripeAccountId,
        paymentSettlementStatus: "PENDING",
        listingKindSnapshot: product.listingKind.trim().toUpperCase(),
        ...(resolvedBookingSlotId ? { bookingSlotId: resolvedBookingSlotId } : {}),
      },
    })

    if (resolvedBookingSlotId) {
      const hold = await reserveBookingSlotHoldInTransaction(tx, {
        orderId: created.id,
        productId: product.id,
        slotId: resolvedBookingSlotId,
        quantity: checkoutQty,
        listingKind: product.listingKind,
        seatLabels: checkoutSeatLabels,
      })
      if (!hold.ok) {
        throw new Error(hold.error)
      }
    }

    return created
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    if (
      msg === "booking_slot_unavailable" ||
      msg === "booking_slot_not_found" ||
      msg === "booking_seat_unavailable" ||
      msg === "booking_seat_not_found" ||
      msg === "booking_seats_required" ||
      msg === "booking_seats_qty_mismatch"
    ) {
      return null
    }
    throw e
  })

  if (!order) {
    return NextResponse.json({ error: "booking_slot_unavailable" }, { status: 409 })
  }

  const { baseUrl, cancelPath, successPath } = checkoutBaseUrls(body, request)

  const allowedCountries = await resolveStripeCheckoutAllowedCountries()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    ...marketplaceCheckoutPaymentSessionOptions(),
    line_items: stripeLineItems,
    ...marketplaceCheckoutTaxOptions(),
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    customer_creation: "always",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: allowedCountries as StripeCheckoutAllowedCountries,
    },
    phone_number_collection: { enabled: true },
    payment_intent_data: {
      metadata: {
        flow: "marketplace",
        sellerId: product.supplierId,
        orderId: order.id,
        productId: product.id,
        affiliateProductId: affiliateProduct.id,
        ...(buyerUserId ? { buyerUserId } : {}),
      },
    },
    metadata: {
      orderId: order.id,
      productId: product.id,
      affiliateProductId: affiliateProduct.id,
      supplierId: product.supplierId,
      sellerId: product.supplierId,
      affiliateId: affiliate.id,
      appliedRewardCents: String(appliedCents),
      linePaids: JSON.stringify(paidLineCents),
      checkoutQty: String(checkoutQty),
      checkoutVariantLabel: oneShotVariantLabel || "",
      checkoutVariantSignature: oneShotVariantSignature || "",
      locale: checkoutLocale,
      ...(resolvedBookingSlotId ? { bookingSlotId: resolvedBookingSlotId } : {}),
      ...(buyerUserId ? { buyerUserId } : {}),
    },
  })

  console.log("[checkout]", {
    flow: "single",
    sessionId: checkoutSession.id,
    orderId: order.id,
    affiliateProductId: affiliateProduct.id,
    baseUrl,
    allowedCountries: allowedCountries.length,
    qty: checkoutQty,
  })

  if (!checkoutSession.url) {
    await import("@/lib/booking/slot-hold").then(({ releaseBookingSlotHoldForOrder }) =>
      releaseBookingSlotHoldForOrder(order.id)
    )
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: checkoutSession.id },
  })

  return NextResponse.json({ url: checkoutSession.url, orderId: order.id })
}
