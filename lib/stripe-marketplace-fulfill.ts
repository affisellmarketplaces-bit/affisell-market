import type { Prisma } from "@prisma/client"
import { resolveLineMarkupCents } from "@/lib/money/sale-split"
import type Stripe from "stripe"

import { resolveMarketplaceOrderLineImageUrl } from "@/lib/cart-line-image"
import { formatCartVariantLabel, parseCartVariantSignature } from "@/lib/cart-variant"
import { buyerEarnCentsForLinePaid } from "@/lib/buyer-reward-earn"
import { runAfterResponse } from "@/lib/after-response"
import { recordOrderReturnTerms } from "@/lib/return-terms.server"
import { earnBuyerRewardIdempotent, redeemBuyerRewardIdempotent } from "@/lib/buyer-reward-ledger"
import { ensureBuyerUserIdFromStripeCheckout } from "@/lib/ensure-buyer-from-stripe-checkout"
import { resolveBuyerUserIdForEarn } from "@/lib/buyer-reward-resolve-user"
import { resolveAffisellCommissionRateBpsForProductId } from "@/lib/affisell-platform-commission.server"
import { recordAffiliateSaleFromOrder } from "@/lib/legal/affiliate-commissionnaire.server"
import {
  AFFILIATE_COMMISSION_REQUIRED_ERROR,
  productHasExplicitSupplierCommission,
} from "@/lib/supplier-explicit-commission"
import { resolveSupplierCommissionRateBpsForProductId } from "@/lib/supplier-commission-rate.server"
import {
  phase1AffiliateMarginRetainedCents,
} from "@/lib/marketplace-phase1-fees"
import {
  buildPhase1FeesForOrderLine,
  netSupplierPayoutCents,
  orderUsesAffisellAutoBuy,
} from "@/lib/marketplace-supplier-fee"
import {
  affiliateSaleNotificationSettlement,
  computeMarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import { computeOrderEscrowAllocation } from "@/lib/order-escrow-allocation"
import { triggerAutoFulfillmentForStripeSession } from "@/lib/auto-order/enqueue"
import { triggerAutoDsForStripeSession } from "@/lib/autods/submit-paid-order"
import { computeShipDeadlineAtForRoute } from "@/lib/supplier-ship-sla-shared"
import { extractShippingCountryIso2FromAddress } from "@/lib/trusted-carriers-shared"
import { attachOrderCgvAcceptance } from "@/lib/legal/acceptance"
import { applyInstantDigitalDeliveryInTransaction } from "@/lib/digital-delivery/instant-fulfill"
import { sendDigitalAccessPassEmail } from "@/lib/emails/send-digital-access-pass"
import { runBookingPassAfterPayment } from "@/lib/booking/run-after-payment"
import { logStripeWebhookError } from "@/lib/stripe-webhook-observability"
import { isStockManagedForLine, resolveCheckoutStockMode } from "@/lib/checkout-stock"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import {
  lockProductsForStockInTransaction,
  reserveStockInTransaction,
} from "@/lib/checkout-stock.server"
import {
  unallocatedLineKey,
  type UnallocatedLine,
  type UnallocatedLineReason,
} from "@/lib/unallocated-line"
import {
  loadRefundedUnallocatedLineKeys,
  recordUnallocatedLines,
} from "@/lib/unallocated-line.server"
import {
  resolveOrderConfirmationImageUrl,
  sendOrderConfirmationEmail,
} from "@/lib/emails/send-order-confirmation"
import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import { affiliateNotificationSettlementFromOrder } from "@/lib/marketplace-order-notification-heal"
import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"
import { healMarketplaceOrderNotifications } from "@/lib/marketplace-order-notification-heal"
import { syncMarketplaceOrderToMedusa, syncMarketplaceOrderToMedusaIfNeeded } from "@/lib/medusa/sync-marketplace-order"
import { prisma } from "@/lib/prisma"
import {
  parseAffiliateVariantPricingJson,
  resolveAffiliateSellingPriceCentsForOption,
  resolveLineAffiliateFixedMarginCents,
} from "@/lib/affiliate-variant-pricing"
import {
  marketplaceWholesaleCentsForOption,
  variantsFromDb,
} from "@/lib/product-variants"

type Tx = Prisma.TransactionClient

const MARKETPLACE_FULFILL_TX_OPTIONS = { timeout: 60_000, maxWait: 15_000 } as const

const CHECKOUT_FULFILL_LOCK_PREFIX = "affisell:checkout:"

function isPrismaUniqueOnField(err: unknown, field: string): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false
  if ((err as { code: string }).code !== "P2002") return false
  const target = (err as { meta?: { target?: string[] } }).meta?.target
  return Array.isArray(target) && target.includes(field)
}

async function acquireCheckoutFulfillLock(tx: Tx, sessionId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${CHECKOUT_FULFILL_LOCK_PREFIX}${sessionId}`}))`
}

type OrderConfirmationEmailPayload = Parameters<typeof sendOrderConfirmationEmail>[0]

const listingWithProductInclude = {
  product: {
    include: {
      supplier: {
        select: {
          supplierFeeBps: true,
          supplierFeeBpsCatalog: true,
          supplierFeeBpsAutoBuy: true,
        },
      },
    },
  },
  affiliate: {
    select: {
      stripeAccountId: true,
      affiliatePlatformFeeBps: true,
      store: { select: { partnerListingCode: true } },
    },
  },
} satisfies Prisma.AffiliateProductInclude

type ListingWithProduct = Prisma.AffiliateProductGetPayload<{
  include: typeof listingWithProductInclude
}>

async function runInstantDigitalDeliveryAfterPayment(
  tx: Tx,
  args: {
    orderId: string
    customerEmail: string
    buyerUserId: string | null
    buyerLocale?: string | null
    product: ListingWithProduct["product"]
  }
): Promise<void> {
  const digitalResult = await applyInstantDigitalDeliveryInTransaction(tx, {
    orderId: args.orderId,
    customerEmail: args.customerEmail,
    buyerUserId: args.buyerUserId,
    product: {
      listingKind: args.product.listingKind,
      digitalAccessUrl: args.product.digitalAccessUrl,
      digitalAccessInstructions: args.product.digitalAccessInstructions,
      digitalInstantDelivery: args.product.digitalInstantDelivery,
      name: args.product.name,
    },
  })

  if (digitalResult.delivered) {
    void sendDigitalAccessPassEmail({
      orderId: args.orderId,
      productName: args.product.name,
      customerEmail: args.customerEmail,
      passPath: digitalResult.passPath,
      accessUrl: digitalResult.accessUrl,
      instructions: digitalResult.instructions,
      locale: args.buyerLocale,
    })
    const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
    triggerOrderTransferRelease(args.orderId)
  }
}

async function runBookingPassAfterPaymentForOrder(
  tx: Tx,
  args: {
    orderId: string
    quantity: number
    buyerUserId: string | null
    buyerLocale?: string | null
    customerEmail: string
    product: ListingWithProduct["product"]
  }
): Promise<void> {
  const orderRow = await tx.order.findUnique({
    where: { id: args.orderId },
    select: { bookingSlotId: true },
  })
  await runBookingPassAfterPayment(tx, {
    orderId: args.orderId,
    quantity: args.quantity,
    buyerUserId: args.buyerUserId,
    buyerLocale: args.buyerLocale,
    customerEmail: args.customerEmail,
    bookingSlotId: orderRow?.bookingSlotId ?? null,
    product: {
      id: args.product.id,
      listingKind: args.product.listingKind,
      bookingCancellationHours: args.product.bookingCancellationHours,
      bookingVenueLabel: args.product.bookingVenueLabel,
      bookingInstantConfirm: args.product.bookingInstantConfirm,
      name: args.product.name,
      supplierId: args.product.supplierId,
    },
  })
}

function parseLinePaids(raw: string | undefined | null): number[] | null {
  if (!raw?.trim()) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return null
    return v.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n))
  } catch {
    return null
  }
}

/** Structured log of what the stock reservation did (`would_drop` = warn mode: the stock could not serve this paid line). */
function logStockReservation(
  productId: string,
  qty: number,
  stripeSessionId: string,
  reservation: Awaited<ReturnType<typeof reserveStockInTransaction>>
): void {
  if (reservation.kind !== "reserved") return
  console.log("[stock]", {
    productId,
    stripeSessionId,
    result: reservation.shortfall ? "would_drop" : "reserved",
    mode: reservation.shortfall ? "warn" : undefined,
    scope: reservation.scope,
    qty,
    before: reservation.before,
    after: reservation.after,
    ...(reservation.shortfall ? { shortfall: reservation.shortfall } : {}),
  })
}

/**
 * Closes the pre-created (PENDING) order of a single-line checkout whose paid line could not be served (finalisation
 * master doc D6 / G1): `CANCELLED` status AND settlement, which `isOrderClosedForPayout` reads, so that no later step can
 * reopen it — `scheduleMarketplaceTransferAttempts` (webhook, success page, `payment_intent.succeeded`) refuses it, the
 * reconcile crons only look at PENDING rows. The money is not lost: it is in the unallocated-line trace. Orders that hold
 * a booking slot are left alone (the slot hold has its own release).
 */
async function closeUnallocatedPendingOrder(
  db: Pick<Tx, "order">,
  order: { id: string; bookingSlotId?: string | null } | null | undefined
): Promise<void> {
  if (!order || order.bookingSlotId) return
  await db.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: "CANCELLED", paymentSettlementStatus: "CANCELLED" },
  })
}

/** HT cents the buyer paid for line `index` according to the checkout metadata, `null` when it is not there. */
function linePaidCentsFromMetadata(linePaids: number[] | null, lineCount: number, index: number): number | null {
  if (!linePaids || linePaids.length !== lineCount) return null
  const v = linePaids[index]
  return v == null ? null : Math.max(0, v)
}

async function createPaidMarketplaceOrder(
  tx: Tx,
  args: {
    stripeSessionId: string
    listing: ListingWithProduct
    qty: number
    paidLineCents: number
    buyerUserId: string | null
    customerEmail: string
    shippingAddress: Prisma.InputJsonValue
    variantLabel: string
    variantSignature?: string
    partnerListingCode?: string | null
    checkoutAmountTotal: number
    checkoutSubtotalCents: number
    checkoutTaxCents: number
    checkoutCurrency: string
    buyerLocale?: string | null
    /**
     * Called when the line is paid but NO order is created for a reason that needs a human or a refund
     * (finalisation master doc D6 / G1) — the caller records it durably once the transaction is done.
     */
    onUnallocated?: (u: { reason: UnallocatedLineReason; detail?: Record<string, unknown> }) => void
    /** When set, the confirmation e-mail is handed over instead of being sent inside the transaction. */
    deferConfirmation?: (payload: OrderConfirmationEmailPayload) => void
  }
): Promise<string | null> {
  const { listing, qty } = args
  const variants = variantsFromDb(listing.product.variants)
  const parsed = parseCartVariantSignature(args.variantSignature ?? "")
  const optionName = parsed.color || args.variantLabel.split("·")[0]?.trim() || null
  if (
    !productHasExplicitSupplierCommission({
      commissionRate: listing.product.commissionRate,
      variants: listing.product.variants,
      offerMode: listing.product.offerMode,
      optionName,
    })
  ) {
    console.log("[stripe-marketplace-fulfill]", {
      error: AFFILIATE_COMMISSION_REQUIRED_ERROR,
      productId: listing.productId,
    })
    args.onUnallocated?.({ reason: "commission_not_explicit" })
    return null
  }
  const variantImageUrl =
    resolveMarketplaceOrderLineImageUrl(listing, args.variantLabel, args.variantSignature) || null
  const basePriceCents =
    marketplaceWholesaleCentsForOption({
      productBasePriceCents: listing.product.basePriceCents,
      variants,
      optionName,
    }) * qty
  const supplierCommissionRateBpsBase = await resolveSupplierCommissionRateBpsForProductId({
    productId: listing.productId,
    optionName,
    variants,
  })
  const { resolveActiveLegionBoostCommission, recordLegionBoostSale } = await import(
    "@/lib/legion/resolve-active-boost-commission"
  )
  const legionBoost = await resolveActiveLegionBoostCommission(tx, listing.productId)
  const supplierCommissionRateBps = legionBoost?.commissionBps ?? supplierCommissionRateBpsBase
  if (legionBoost) {
    console.log("[legion-boost]", {
      result: "checkout_commission_override",
      productId: listing.productId,
      boostId: legionBoost.boostId,
      commissionBps: legionBoost.commissionBps,
      baseBps: supplierCommissionRateBpsBase,
    })
  }
  const affisellCommissionRateBps = await resolveAffisellCommissionRateBpsForProductId(
    listing.productId
  )
  const variantPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
  const lineAffiliateMarginCents = resolveLineAffiliateFixedMarginCents({
    listingMarginCents: listing.marginCents,
    qty,
    variantPricing,
    optionName,
  })
  const clientLineHtCents = Math.max(0, Math.round(args.paidLineCents))
  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: clientLineHtCents,
    supplierPriceCents: basePriceCents,
    supplierCommissionRateBps,
    affiliateMarginCents: lineAffiliateMarginCents,
    affisellCommissionRateBps,
    affisellFeeBaseCents: clientLineHtCents,
  })

  const supplierLink = await tx.supplierLink.findUnique({
    where: { productId: listing.productId },
    select: { aePriceCents: true, isActive: true, autoBuyEnabled: true },
  })
  const usesAffisellAutoBuy = orderUsesAffisellAutoBuy({
    supplierLink,
    productAutoBuyEnabled: listing.product.autoBuyEnabled,
  })
  const aeWholesaleCents =
    usesAffisellAutoBuy && supplierLink?.aePriceCents
      ? supplierLink.aePriceCents * qty
      : null

  const grossAffiliateMarkupCents = resolveLineMarkupCents({
    collectedHtCents: clientLineHtCents,
    wholesaleCents: basePriceCents,
    fixedListingMarginCents: lineAffiliateMarginCents,
  })

  const phase1Fees = buildPhase1FeesForOrderLine({
    usesAffisellAutoBuy,
    supplier: listing.product.supplier,
    supplierPriceCents: basePriceCents,
    aeWholesaleCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: grossAffiliateMarkupCents,
    affiliatePlatformFeeBps: listing.affiliate.affiliatePlatformFeeBps,
    categoryFeeBps: affisellCommissionRateBps,
  })

  console.log("[marketplace-fees]", {
    productId: listing.productId,
    usesAffisellAutoBuy,
    supplierFeeBps: phase1Fees.supplierFeeBps,
    wholesaleForFeesCents: phase1Fees.wholesaleForFeesCents,
    supplierFeeCents: phase1Fees.supplierFeeCents,
    affiliateFeeCents: phase1Fees.affiliateFeeCents,
  })

  const affiliateMarginRetainedCents = phase1AffiliateMarginRetainedCents({
    clientLineHtCents,
    supplierPriceCents: basePriceCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateFeeCents: phase1Fees.affiliateFeeCents,
    fixedListingMarginCents: lineAffiliateMarginCents,
  })

  const supplierNetPayoutCents = netSupplierPayoutCents({
    supplierPriceCents: basePriceCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    supplierFeeCents: phase1Fees.supplierFeeCents,
  })

  const escrowAllocation = computeOrderEscrowAllocation({
    usesAffisellAutoBuy,
    aeWholesaleCents,
    supplierPayoutCents: supplierNetPayoutCents,
  })

  const lineTaxCents =
    args.checkoutSubtotalCents > 0 && args.checkoutTaxCents > 0
      ? Math.round((args.checkoutTaxCents * clientLineHtCents) / args.checkoutSubtotalCents)
      : 0
  const lineTotalCents = clientLineHtCents + lineTaxCents
  const unitSupplierCents = Math.round(basePriceCents / qty)
  // Total gross markup of the line (exact — no per-unit rounding × qty).
  const affiliateMarginTotalCents = affiliateMarginRetainedCents

  let order
  const existingBeforeCreate = await tx.order.findUnique({
    where: { stripeSessionId: args.stripeSessionId },
    select: { id: true, status: true },
  })
  if (existingBeforeCreate?.status === "paid") {
    console.log("[marketplace-fulfill]", {
      stripeSessionId: args.stripeSessionId,
      orderId: existingBeforeCreate.id,
      result: "idempotent_read_paid",
    })
    return existingBeforeCreate.id
  }
  if (existingBeforeCreate?.status === "PENDING") {
    console.log("[marketplace-fulfill]", {
      stripeSessionId: args.stripeSessionId,
      orderId: existingBeforeCreate.id,
      result: "idempotent_pending_exists",
    })
    return null
  }

  // G1: take the units from the stock in THIS transaction, right before the order that pays for them is written. A
  // shortfall (two buyers paid for the last unit) creates no order and no negative stock: the line is unallocated.
  const reservation = await reserveStockInTransaction(tx, {
    productId: listing.productId,
    variantSignature: args.variantSignature,
    qty,
    listingKind: listing.product.listingKind,
    known: { hasVariants: listing.product.hasVariants, variants: listing.product.variants },
  })
  if (reservation.kind === "insufficient") {
    console.log("[marketplace-fulfill]", {
      stripeSessionId: args.stripeSessionId,
      productId: listing.productId,
      result: "unallocated_insufficient_stock",
      scope: reservation.scope,
      available: reservation.available,
      requested: reservation.requested,
    })
    args.onUnallocated?.({
      reason: "insufficient_stock",
      detail: { scope: reservation.scope, available: reservation.available, requested: reservation.requested },
    })
    return null
  }
  logStockReservation(listing.productId, qty, args.stripeSessionId, reservation)

  try {
    order = await tx.order.create({
      data: {
        stripeSessionId: args.stripeSessionId,
        productId: listing.productId,
        affiliateProductId: listing.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        buyerUserId: args.buyerUserId,
        buyerLocale: args.buyerLocale?.trim() || null,
        listingKindSnapshot: listing.product.listingKind.trim().toUpperCase(),
        customerEmail: args.customerEmail,
        quantity: qty,
        shippingAddress: args.shippingAddress,
        variantLabel: args.variantLabel || null,
        variantImageUrl,
        basePriceCents,
        sellingPriceCents: settlement.sellingPriceCents,
        marginCents: settlement.marginCents,
        commissionCents: settlement.affiliateCommissionCents,
        affiliatePayoutCents: settlement.affiliateCommissionCents,
        affisellFeeCents: phase1Fees.affisellFeeTotalCents,
        supplierFeeCents: phase1Fees.supplierFeeCents,
        affiliateFeeCents: phase1Fees.affiliateFeeCents,
        aeWholesaleCents,
        upstreamCogsCents: escrowAllocation.upstreamCogsCents,
        supplierMarginCents: escrowAllocation.supplierMarginCents,
        usesAffisellAutoBuy,
        affiliateMarginRetainedCents,
        supplierPriceCents: unitSupplierCents * qty,
        supplierCommissionRateBps,
        supplierPayoutCents: supplierNetPayoutCents,
        affiliateMarginCents: affiliateMarginTotalCents,
        pricingFreedom: true,
        affisellCommissionRateBps,
        status: "paid",
        paidAt: new Date(),
        shipDeadlineAt: computeShipDeadlineAtForRoute(
          new Date(),
          listing.product.shippingCountry,
          extractShippingCountryIso2FromAddress(args.shippingAddress)
        ),
        fulfillmentStatus: "PENDING",
        subtotalCents: settlement.affisellFeeBaseCents,
        taxCents: lineTaxCents,
        totalCents: lineTotalCents,
        paymentSettlementStatus: "PENDING",
        affiliateStripeAccountId: listing.affiliate.stripeAccountId?.trim() || null,
        currency: args.checkoutCurrency.toUpperCase(),
      },
    })
  } catch (err) {
    if (isPrismaUniqueOnField(err, "stripeSessionId")) {
      const existing = await tx.order.findUnique({
        where: { stripeSessionId: args.stripeSessionId },
        select: { id: true, status: true },
      })
      if (existing?.status === "paid") {
        console.log("[marketplace-fulfill]", {
          stripeSessionId: args.stripeSessionId,
          orderId: existing.id,
          result: "idempotent_duplicate_stripe_session",
        })
        return existing.id
      }
      if (existing?.status === "PENDING") {
        console.log("[marketplace-fulfill]", {
          stripeSessionId: args.stripeSessionId,
          orderId: existing.id,
          result: "idempotent_pending_stripe_session",
        })
        return null
      }
    }
    throw err
  }

  await recordAffiliateSaleFromOrder(tx, {
    id: order.id,
    affiliateId: listing.affiliateId,
    supplierId: listing.product.supplierId,
    supplierPriceCents: unitSupplierCents * qty,
    affiliateMarginCents: affiliateMarginTotalCents,
    affiliatePayoutCents: settlement.affiliateCommissionCents,
    sellingPriceCents: settlement.sellingPriceCents,
  })

  await syncMarketplaceOrderToMedusa(tx, {
    orderId: order.id,
    medusaOrderId: order.medusaOrderId,
    productId: listing.productId,
    productName: listing.product.name,
    quantity: qty,
    linePriceCents: clientLineHtCents,
    customerEmail: args.customerEmail,
    shippingAddress: args.shippingAddress as Prisma.JsonValue,
    stripeSessionId: args.stripeSessionId,
    currency: args.checkoutCurrency,
    buyerUserId: args.buyerUserId,
  })

  await tx.affiliateProduct.update({
    where: { id: listing.id },
    data: { conversions: { increment: qty } },
  })

  try {
    const { accrueSponsorSuccessFeesForOrder } = await import(
      "@/lib/sponsor/charge-sponsor-on-sale"
    )
    await accrueSponsorSuccessFeesForOrder(tx, {
      orderId: order.id,
      productId: listing.productId,
      affiliateProductId: listing.id,
      htCents: settlement.affisellFeeBaseCents,
      supplierId: listing.product.supplierId,
      affiliateId: listing.affiliateId,
    })
  } catch (sponsorErr) {
    console.error("[sponsor]", {
      result: "success_fee_accrual_failed",
      orderId: order.id,
      error: sponsorErr instanceof Error ? sponsorErr.message : String(sponsorErr),
    })
  }

  try {
    const { applyLegionReferralOverrideOnFulfill } = await import(
      "@/lib/legion/apply-referral-override"
    )
    await applyLegionReferralOverrideOnFulfill(tx, {
      orderId: order.id,
      affiliateId: listing.affiliateId,
      sellingPriceCents: settlement.sellingPriceCents,
    })
  } catch (legionOverrideErr) {
    console.error("[legion]", {
      result: "override_reserve_failed",
      orderId: order.id,
      error:
        legionOverrideErr instanceof Error
          ? legionOverrideErr.message
          : String(legionOverrideErr),
    })
  }

  if (legionBoost) {
    try {
      await recordLegionBoostSale(tx, {
        boostId: legionBoost.boostId,
        qty,
        gmvCents: settlement.affisellFeeBaseCents,
      })
    } catch (legionErr) {
      console.error("[legion-boost]", {
        result: "sale_record_failed",
        orderId: order.id,
        error: legionErr instanceof Error ? legionErr.message : String(legionErr),
      })
    }
  }

  const variantBit = args.variantLabel ? ` · ${args.variantLabel}` : ""
  const orderSnapshot = await tx.order.findUnique({
    where: { id: order.id },
    select: {
      subtotalCents: true,
      sellingPriceCents: true,
      totalCents: true,
      taxCents: true,
      supplierPriceCents: true,
      basePriceCents: true,
      marginCents: true,
      affisellFeeCents: true,
      commissionCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      supplierPayoutCents: true,
      supplierFeeCents: true,
    },
  })
  await createMarketplaceOrderNotifications(tx, {
    orderId: order.id,
    supplierId: listing.product.supplierId,
    affiliateId: listing.affiliateId,
    productName: listing.product.name,
    variantBit,
    qty,
    customerEmail: args.customerEmail,
    partnerListingCode: args.partnerListingCode,
    settlement: orderSnapshot
      ? affiliateNotificationSettlementFromOrder(orderSnapshot)
      : affiliateSaleNotificationSettlement(settlement, {
          affiliateMarginRetainedCents,
          affiliatePlatformFeeCents: phase1Fees.affiliateFeeCents,
        }),
    supplierNetCents: orderSnapshot?.supplierPayoutCents ?? supplierNetPayoutCents,
    supplierPlatformFeeCents: orderSnapshot?.supplierFeeCents ?? phase1Fees.supplierFeeCents,
    usesAffisellAutoBuy,
    taxCents: orderSnapshot?.taxCents ?? lineTaxCents,
    totalCents: orderSnapshot?.totalCents ?? lineTotalCents,
    imageUrl: variantImageUrl,
  })

  const productImageUrl = resolveOrderConfirmationImageUrl({
    productImages: listing.product.images,
    customImages: listing.customImages,
    variantImageUrl,
  })

  const shippingName =
    args.shippingAddress &&
    typeof args.shippingAddress === "object" &&
    !Array.isArray(args.shippingAddress) &&
    typeof (args.shippingAddress as Record<string, unknown>).name === "string"
      ? ((args.shippingAddress as Record<string, unknown>).name as string).trim()
      : undefined

  const confirmationPayload: OrderConfirmationEmailPayload = {
    orderId: order.id,
    productName: listing.product.name,
    productImageUrl,
    quantity: qty,
    total: (args.paidLineCents / 100).toFixed(2),
    currency: args.checkoutCurrency,
    customerEmail: args.customerEmail,
    customerName: shippingName,
    locale: args.buyerLocale,
    affiliateId: listing.affiliateId,
  }
  if (args.deferConfirmation) {
    // The e-mail provider is network I/O: sent after the commit, never while this transaction holds the product lock.
    args.deferConfirmation(confirmationPayload)
  } else {
    try {
      await sendOrderConfirmationEmail(confirmationPayload)
    } catch (e) {
      logStripeWebhookError({
        metric: "order_confirmation_email_failed",
        orderId: order.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  await runInstantDigitalDeliveryAfterPayment(tx, {
    orderId: order.id,
    customerEmail: args.customerEmail,
    buyerUserId: args.buyerUserId,
    buyerLocale: args.buyerLocale,
    product: listing.product,
  })

  await runBookingPassAfterPaymentForOrder(tx, {
    orderId: order.id,
    quantity: qty,
    buyerUserId: args.buyerUserId,
    buyerLocale: args.buyerLocale,
    customerEmail: args.customerEmail,
    product: listing.product,
  })

  await attachOrderCgvAcceptance(tx, {
    orderId: order.id,
    userId: args.buyerUserId,
    buyerEmail: args.customerEmail,
    locale: args.buyerLocale,
  })

  return order.id
}

function scheduleMerchantOrderAlerts(orderIds: string[]): void {
  const ids = [...new Set(orderIds)]
  if (ids.length === 0) return
  // After the response (kept alive by the platform) — a floating promise could be cut once the response is sent.
  void runAfterResponse("merchant_order_alerts", () =>
    Promise.allSettled(ids.flatMap((id) => [dispatchMerchantOrderAlerts(id), healMarketplaceOrderNotifications(id)]))
  )
  // Freeze the return window the product offered at this purchase (supplier-extended returns). Outside the payment
  // transaction on purpose: it is idempotent, never throws, and a failure only means the buyer keeps the legal 14 days.
  void runAfterResponse("order_return_terms", () => recordOrderReturnTerms(ids))
}

async function redeemBuyerRewardOrSkip(
  tx: Tx,
  args: { userId: string; amountCents: number; stripeSessionId: string }
): Promise<void> {
  if (!args.userId || args.amountCents <= 0) return
  const r = await redeemBuyerRewardIdempotent(tx, args)
  if (!r.ok) {
    logStripeWebhookError({
      metric: "buyer_redeem_skipped",
      sessionId: args.stripeSessionId,
      error: r.reason,
    })
  }
}

export async function fulfillMarketplaceStripeSession(
  session: Stripe.Checkout.Session,
  shippingAddress: Prisma.InputJsonValue,
  customerEmail: string
): Promise<void> {
  const sessionId = session.id
  const checkoutAmountTotal = session.amount_total ?? 0
  const checkoutSubtotalCents = session.amount_subtotal ?? checkoutAmountTotal
  const checkoutTaxCents = session.total_details?.amount_tax ?? 0
  const checkoutCurrency = session.currency ?? "eur"
  const meta = session.metadata ?? {}
  const buyerLocale = meta.locale?.trim() || null
  const stripePhone = session.customer_details?.phone?.trim() || null
  let buyerUserId = meta.buyerUserId?.trim() || ""
  if (!buyerUserId) {
    buyerUserId =
      (await ensureBuyerUserIdFromStripeCheckout(customerEmail, stripePhone)) ?? ""
  }
  const appliedRewardCents = Math.max(0, Math.round(parseInt(meta.appliedRewardCents ?? "0", 10) || 0))
  const linePaids = parseLinePaids(meta.linePaids)

  const cartLinesRaw = meta.cartLines?.trim()
  if (cartLinesRaw) {
    type CartLineMeta = {
      affiliateProductId: string
      qty: number
      variantSignature?: string
      variantLabel?: string
    }
    let lines: CartLineMeta[] = []
    try {
      lines = JSON.parse(cartLinesRaw) as CartLineMeta[]
    } catch {
      return
    }
    if (!Array.isArray(lines) || lines.length === 0) return

    const stripeIds = lines.map((_, i) => `${sessionId}:line:${i}`)
    const existingRows = await prisma.order.findMany({
      where: { stripeSessionId: { in: stripeIds } },
      select: { id: true, stripeSessionId: true, status: true },
    })
    const allPaid = stripeIds.every((id) =>
      existingRows.some((row) => row.stripeSessionId === id && row.status === "paid")
    )
    if (allPaid) {
      for (const row of existingRows) {
        await syncMarketplaceOrderToMedusaIfNeeded(row.id)
      }
      scheduleMerchantOrderAlerts(existingRows.map((row) => row.id))
      return
    }

    const fulfilledOrderIds: string[] = []
    const unallocated: UnallocatedLine[] = []
    const confirmations: OrderConfirmationEmailPayload[] = []
    let alreadyFulfilled = false

    // A line whose money was already sent back (unallocated-line refund) must never become an order afterwards.
    // Read before the transaction, never throws (an unreadable trace must not block the payment processing).
    const refundedLineKeys = await loadRefundedUnallocatedLineKeys(
      lines.map((_, i) => unallocatedLineKey(sessionId, i))
    )

    await prisma.$transaction(async (tx) => {
      await acquireCheckoutFulfillLock(tx, sessionId)

      const lockedRows = await tx.order.findMany({
        where: { stripeSessionId: { in: stripeIds } },
        select: { id: true, stripeSessionId: true, status: true },
      })
      const allPaidLocked = stripeIds.every((id) =>
        lockedRows.some((row) => row.stripeSessionId === id && row.status === "paid")
      )
      if (allPaidLocked) {
        alreadyFulfilled = true
        fulfilledOrderIds.push(...lockedRows.filter((row) => row.status === "paid").map((row) => row.id))
        return
      }

      const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

      // Lock the physical products of a multi-line cart in ascending id order BEFORE any line: two carts holding the same
      // two products in opposite order would otherwise take the row locks in opposite order and deadlock.
      if (lines.length > 1 && resolveCheckoutStockMode() !== "off") {
        const listingIds = [...new Set(lines.map((l) => l.affiliateProductId).filter(Boolean))]
        const lockRows = await tx.affiliateProduct.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true,
            productId: true,
            product: { select: { listingKind: true, hasVariants: true, variants: true } },
          },
        })
        const lockedProductIds = new Set<string>()
        for (const line of lines) {
          const row = lockRows.find((r) => r.id === line.affiliateProductId)
          if (
            row?.product &&
            isStockManagedForLine({
              listingKind: row.product.listingKind,
              hasVariants: row.product.hasVariants,
              variants: row.product.variants,
              variantSignature: typeof line.variantSignature === "string" ? line.variantSignature : "",
            })
          ) {
            lockedProductIds.add(row.productId)
          }
        }
        await lockProductsForStockInTransaction(tx, [...lockedProductIds])
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const stripeSessionId = `${sessionId}:line:${i}`
        const dup = await tx.order.findUnique({ where: { stripeSessionId } })
        if (dup?.status === "paid") {
          fulfilledOrderIds.push(dup.id)
          continue
        }
        if (refundedLineKeys.has(unallocatedLineKey(sessionId, i))) {
          console.log("[marketplace-fulfill]", {
            sessionId,
            line: i,
            result: "skipped_unallocated_line_already_refunded",
          })
          continue
        }

        const qty = Math.max(1, Math.round(Number(line.qty)) || 1)
        const listing = await tx.affiliateProduct.findUnique({
          where: { id: line.affiliateProductId },
          include: listingWithProductInclude,
        })

        const fulfillingPreCreated = dup?.status === "PENDING"
        if (!listing?.product) {
          console.log("[marketplace-fulfill]", {
            sessionId,
            line: i,
            affiliateProductId: line.affiliateProductId,
            result: "skipped_no_listing",
          })
          unallocated.push({
            lineIndex: i,
            reason: "listing_not_found",
            affiliateProductId: line.affiliateProductId ?? null,
            productId: null,
            qty,
            paidLineCents: linePaidCentsFromMetadata(linePaids, lines.length, i),
          })
          continue
        }
        if (!fulfillingPreCreated && !listing.product.active) {
          console.log("[marketplace-fulfill]", {
            sessionId,
            line: i,
            affiliateProductId: line.affiliateProductId,
            result: "skipped_inactive_listing",
          })
          unallocated.push({
            lineIndex: i,
            reason: "listing_inactive",
            affiliateProductId: listing.id,
            productId: listing.productId,
            qty,
            paidLineCents: linePaidCentsFromMetadata(linePaids, lines.length, i),
          })
          continue
        }

        const sigStr = typeof line.variantSignature === "string" ? line.variantSignature : ""
        const parsed = parseCartVariantSignature(sigStr)
        const variants = variantsFromDb(listing.product.variants)
        const variantPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
        const optionName = parsed.color || null
        const listLineCents =
          resolveAffiliateSellingPriceCentsForOption({
            listingSellingPriceCents: listing.sellingPriceCents,
            productBasePriceCents: listing.product.basePriceCents,
            variants,
            optionName,
            variantPricing,
          }) * qty
        const paidLineCents =
          linePaids && linePaids.length === lines.length && linePaids[i] != null
            ? Math.min(listLineCents, Math.max(0, linePaids[i]!))
            : listLineCents
        const variantLabelRaw =
          typeof line.variantLabel === "string" && line.variantLabel.trim()
            ? line.variantLabel.trim()
            : formatCartVariantLabel(parsed.color, parsed.size)

        const orderId = await createPaidMarketplaceOrder(tx, {
          stripeSessionId,
          listing,
          qty,
          paidLineCents,
          buyerUserId: earnUserId || null,
          customerEmail,
          shippingAddress,
          variantLabel: variantLabelRaw,
          variantSignature: sigStr,
          partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
          checkoutAmountTotal,
          checkoutSubtotalCents,
          checkoutTaxCents,
          checkoutCurrency,
          buyerLocale,
          onUnallocated: (u) =>
            unallocated.push({
              lineIndex: i,
              reason: u.reason,
              affiliateProductId: listing.id,
              productId: listing.productId,
              qty,
              paidLineCents,
              detail: u.detail,
            }),
          deferConfirmation: (payload) => confirmations.push(payload),
        })

        if (earnUserId && orderId) {
          const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
          await earnBuyerRewardIdempotent(tx, {
            userId: earnUserId,
            amountCents: earn,
            stripeSessionId: sessionId,
            affiliateProductId: listing.id,
            orderId,
          })
        }

        if (orderId) fulfilledOrderIds.push(orderId)
      }

      // Store credit is consumed only when at least one line became a sale. A checkout whose every line is unallocated
      // keeps the buyer's credit (the cash part is the only thing to give back). The ledger key is per session, so a
      // later replay that allocates a line redeems it then, once. A PARTIAL allocation redeems the whole credit: the
      // share that belonged to an unallocated line is not given back automatically (it is in the trace, `appliedRewardCents`).
      if (fulfilledOrderIds.length > 0) {
        await redeemBuyerRewardOrSkip(tx, {
          userId: buyerUserId,
          amountCents: appliedRewardCents,
          stripeSessionId: sessionId,
        })
      }
    }, MARKETPLACE_FULFILL_TX_OPTIONS)

    // Confirmation e-mails of the orders just created: network I/O, sent after the commit and after the response.
    if (confirmations.length > 0) {
      await runAfterResponse("order_confirmation_emails_cart", async () => {
        for (const payload of confirmations) {
          try {
            await sendOrderConfirmationEmail(payload)
          } catch (e) {
            logStripeWebhookError({
              metric: "order_confirmation_email_failed",
              orderId: payload.orderId,
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      })
    }

    // D6: the lines paid without an order are traced, alerted and (only when enabled) refunded — AFTER the transaction
    // that created the other lines' orders, and after the response like every other side effect of this file.
    if (unallocated.length > 0) {
      await runAfterResponse("unallocated_lines_cart", () =>
        recordUnallocatedLines({ session, lines: unallocated, appliedRewardCents })
      )
    }

    if (alreadyFulfilled) {
      scheduleMerchantOrderAlerts(fulfilledOrderIds)
      await runAfterResponse("medusa_sync_already_fulfilled", async () => {
        for (const orderId of fulfilledOrderIds) {
          await syncMarketplaceOrderToMedusaIfNeeded(orderId)
        }
      })
      return
    }

    scheduleMerchantOrderAlerts(fulfilledOrderIds)

    await runAfterResponse("auto_fulfillment_cart", async () => {
      try {
        await triggerAutoFulfillmentForStripeSession(sessionId)
      } catch (e) {
        console.error("[auto-order] trigger after cart fulfill failed", e)
      }
      try {
        await triggerAutoDsForStripeSession(sessionId)
      } catch (e) {
        console.error("[autods] trigger after cart fulfill failed", e)
      }
    })
    return
  }

  const metaOrderId = meta.orderId?.trim() || ""
  let existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId } })
  if (!existing && metaOrderId) {
    existing = await prisma.order.findUnique({ where: { id: metaOrderId } })
  }
  if (existing?.status === "paid") {
    try {
      const { reconcileMarketplaceOrderPartnerAmounts } = await import(
        "@/lib/marketplace-order-settlement-reconcile"
      )
      await reconcileMarketplaceOrderPartnerAmounts(existing.id)
    } catch (reconcileErr) {
      console.error("[marketplace-fulfill]", {
        sessionId,
        orderId: existing.id,
        stage: "settlement_reconcile",
        error: reconcileErr instanceof Error ? reconcileErr.message : String(reconcileErr),
      })
    }
    scheduleMerchantOrderAlerts([existing.id])
    await runAfterResponse("existing_paid_followups", async () => {
      await syncMarketplaceOrderToMedusaIfNeeded(existing.id)
      try {
        await triggerAutoDsForStripeSession(sessionId)
      } catch (e) {
        console.error("[autods] trigger after existing paid order failed", e)
      }
    })
    return
  }

  const affiliateProductId =
    meta.affiliateProductId?.trim() || existing?.affiliateProductId?.trim() || ""
  if (!affiliateProductId) {
    console.log("[marketplace-fulfill]", { sessionId, result: "skipped_no_listing_id" })
    return
  }

  // A closed order (cancelled / refunded — in particular a pre-created order closed because its line was unallocated) is
  // never fulfilled again: there is nothing to create, and `createPaidMarketplaceOrder` would collide with its session id.
  // A cancelled BOOKING order is the one exception: it is re-opened when the payment arrives late (see below).
  if (
    existing &&
    isOrderClosedForPayout(existing) &&
    !(existing.status === "CANCELLED" && existing.bookingSlotId && !existing.bookingConfirmedAt)
  ) {
    console.log("[marketplace-fulfill]", { sessionId, orderId: existing.id, result: "skipped_order_closed" })
    return
  }

  // A line whose money was already sent back (unallocated-line refund) must never become an order afterwards.
  const singleLineKey = unallocatedLineKey(sessionId, 0)
  if ((await loadRefundedUnallocatedLineKeys([singleLineKey])).has(singleLineKey)) {
    console.log("[marketplace-fulfill]", {
      sessionId,
      result: "skipped_unallocated_line_already_refunded",
    })
    return
  }

  const qty = Math.max(
    1,
    Math.round(parseInt(meta.checkoutQty ?? String(existing?.quantity ?? 1), 10) || 1)
  )
  /** HT cents the buyer paid for this single line per the checkout metadata (`null` for sessions without it). */
  const singlePaidFromMetadata = linePaids && linePaids.length >= 1 ? Math.max(0, linePaids[0]!) : null

  const listing = await prisma.affiliateProduct.findUnique({
    where: { id: affiliateProductId },
    include: listingWithProductInclude,
  })

  if (!listing?.product) {
    console.log("[marketplace-fulfill]", {
      sessionId,
      affiliateProductId,
      result: "skipped_no_listing",
    })
    await closeUnallocatedPendingOrder(prisma, existing)
    await runAfterResponse("unallocated_lines_single", () =>
      recordUnallocatedLines({
        session,
        appliedRewardCents,
        lines: [
          {
            lineIndex: 0,
            reason: "listing_not_found",
            affiliateProductId,
            productId: null,
            qty,
            paidLineCents: singlePaidFromMetadata,
          },
        ],
      })
    )
    return
  }

  const fulfillingPreCreated = existing?.status === "PENDING"
  if (!fulfillingPreCreated && !listing.product.active) {
    console.log("[marketplace-fulfill]", {
      sessionId,
      affiliateProductId,
      result: "skipped_inactive_listing",
    })
    await runAfterResponse("unallocated_lines_single", () =>
      recordUnallocatedLines({
        session,
        appliedRewardCents,
        lines: [
          {
            lineIndex: 0,
            reason: "listing_inactive",
            affiliateProductId: listing.id,
            productId: listing.productId,
            qty,
            paidLineCents: singlePaidFromMetadata,
          },
        ],
      })
    )
    return
  }

  const checkoutVariantLabel =
    meta.checkoutVariantLabel?.trim() || existing?.variantLabel?.trim() || ""
  const checkoutVariantSignature = meta.checkoutVariantSignature?.trim() || ""
  const variants = variantsFromDb(listing.product.variants)
  const variantPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
  const checkoutParsed = parseCartVariantSignature(checkoutVariantSignature)
  const optionName = checkoutParsed.color || checkoutVariantLabel.split("·")[0]?.trim() || null
  const listLineCents =
    resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: listing.sellingPriceCents,
      productBasePriceCents: listing.product.basePriceCents,
      variants,
      optionName,
      variantPricing,
    }) * qty
  const paids = linePaids
  const paidLineCents =
    paids && paids.length >= 1 ? Math.min(listLineCents, Math.max(0, paids[0]!)) : listLineCents

  const deferred = {
    confirmation: null as OrderConfirmationEmailPayload | null,
  }
  const fulfilledOrderIds: string[] = []
  const unallocated: UnallocatedLine[] = []

  await prisma.$transaction(async (tx) => {
    await acquireCheckoutFulfillLock(tx, sessionId)

    let dup = await tx.order.findUnique({ where: { stripeSessionId: sessionId } })
    if (!dup && metaOrderId) {
      dup = await tx.order.findUnique({ where: { id: metaOrderId } })
    }
    if (dup && dup.stripeSessionId !== sessionId) {
      try {
        dup = await tx.order.update({
          where: { id: dup.id },
          data: { stripeSessionId: sessionId },
        })
      } catch (err) {
        if (isPrismaUniqueOnField(err, "stripeSessionId")) {
          const bySession = await tx.order.findUnique({ where: { stripeSessionId: sessionId } })
          if (bySession) {
            console.log("[marketplace-fulfill]", {
              sessionId,
              orderId: bySession.id,
              result: "idempotent_stripe_session_reassign",
            })
            dup = bySession
          } else {
            throw err
          }
        } else {
          throw err
        }
      }
    }
    if (dup?.status === "paid") {
      fulfilledOrderIds.push(dup.id)
      return
    }

    const recoverCancelledBooking =
      dup?.status === "CANCELLED" &&
      Boolean(dup.bookingSlotId) &&
      !dup.bookingConfirmedAt

    if (dup && (dup.status === "PENDING" || recoverCancelledBooking)) {
      // G1 (pre-created order): take the units before anything else is written, so a shortfall leaves the order
      // PENDING and the store credit untouched. A fresh order reserves inside `createPaidMarketplaceOrder`.
      const reservation = await reserveStockInTransaction(tx, {
        productId: listing.productId,
        variantSignature: checkoutVariantSignature,
        qty,
        listingKind: listing.product.listingKind,
        known: { hasVariants: listing.product.hasVariants, variants: listing.product.variants },
      })
      if (reservation.kind === "insufficient") {
        console.log("[marketplace-fulfill]", {
          sessionId,
          productId: listing.productId,
          result: "unallocated_insufficient_stock",
          scope: reservation.scope,
          available: reservation.available,
          requested: reservation.requested,
        })
        unallocated.push({
          lineIndex: 0,
          reason: "insufficient_stock",
          affiliateProductId: listing.id,
          productId: listing.productId,
          qty,
          paidLineCents,
          detail: { scope: reservation.scope, available: reservation.available, requested: reservation.requested },
        })
        // The pre-created order is not a sale: close it NOW, in the same transaction. Left PENDING, the settlement that
        // runs right after this fulfilment (`scheduleMarketplaceTransferAttempts`) would promote it to "paid" and schedule
        // payouts, and the reconcile cron would revisit it forever.
        await closeUnallocatedPendingOrder(tx, dup)
        return
      }
      logStockReservation(listing.productId, qty, sessionId, reservation)
    }

    const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

    // Store credit is taken only once the line is a sale: the pre-created order is reserved above; a fresh order
    // redeems after `createPaidMarketplaceOrder` succeeded (a line without an order must not consume the credit).
    if (dup && (dup.status === "PENDING" || recoverCancelledBooking)) {
      await redeemBuyerRewardOrSkip(tx, {
        userId: buyerUserId,
        amountCents: appliedRewardCents,
        stripeSessionId: sessionId,
      })
    }

    if (dup && (dup.status === "PENDING" || recoverCancelledBooking)) {
      const pendingOrder = dup
      const basePriceCents =
        marketplaceWholesaleCentsForOption({
          productBasePriceCents: listing.product.basePriceCents,
          variants,
          optionName,
        }) * qty
      const affisellCommissionRateBps = await resolveAffisellCommissionRateBpsForProductId(
        listing.productId
      )
      const supplierCommissionRateBps = await resolveSupplierCommissionRateBpsForProductId({
        productId: listing.productId,
        optionName,
        variants,
      })
      const clientLineHtCents = Math.max(0, Math.round(paidLineCents))
      const pendingLineMarginCents = resolveLineAffiliateFixedMarginCents({
        listingMarginCents: listing.marginCents,
        qty,
        variantPricing,
        optionName,
      })
      const settlement = computeMarketplaceOrderSettlement({
        sellingPriceCents: clientLineHtCents,
        supplierPriceCents: basePriceCents,
        supplierCommissionRateBps,
        affiliateMarginCents: pendingLineMarginCents,
        affisellCommissionRateBps,
        affisellFeeBaseCents: clientLineHtCents,
      })
      const dupSupplierLink = await tx.supplierLink.findUnique({
        where: { productId: listing.productId },
        select: { aePriceCents: true, isActive: true, autoBuyEnabled: true },
      })
      const dupUsesAutoBuy = orderUsesAffisellAutoBuy({
        supplierLink: dupSupplierLink,
        productAutoBuyEnabled: listing.product.autoBuyEnabled,
      })
      const dupAeWholesale =
        dupUsesAutoBuy && dupSupplierLink?.aePriceCents
          ? dupSupplierLink.aePriceCents * qty
          : null
      const dupGrossMarkup = resolveLineMarkupCents({
        collectedHtCents: clientLineHtCents,
        wholesaleCents: basePriceCents,
        fixedListingMarginCents: pendingLineMarginCents,
      })
      const dupPhase1Fees = buildPhase1FeesForOrderLine({
        usesAffisellAutoBuy: dupUsesAutoBuy,
        supplier: listing.product.supplier,
        supplierPriceCents: basePriceCents,
        aeWholesaleCents: dupAeWholesale,
        affiliateCommissionCents: settlement.affiliateCommissionCents,
        affiliateMarginRetainedCents: dupGrossMarkup,
        affiliatePlatformFeeBps: listing.affiliate.affiliatePlatformFeeBps,
        categoryFeeBps: affisellCommissionRateBps,
      })
      const dupSupplierNetPayout = netSupplierPayoutCents({
        supplierPriceCents: basePriceCents,
        affiliateCommissionCents: settlement.affiliateCommissionCents,
        supplierFeeCents: dupPhase1Fees.supplierFeeCents,
      })
      const dupEscrow = computeOrderEscrowAllocation({
        usesAffisellAutoBuy: dupUsesAutoBuy,
        aeWholesaleCents: dupAeWholesale,
        supplierPayoutCents: dupSupplierNetPayout,
      })
      const dupAffiliateMargin = phase1AffiliateMarginRetainedCents({
        clientLineHtCents,
        supplierPriceCents: basePriceCents,
        affiliateCommissionCents: settlement.affiliateCommissionCents,
        affiliateFeeCents: dupPhase1Fees.affiliateFeeCents,
        fixedListingMarginCents: pendingLineMarginCents,
      })
      const lineTaxCents =
        checkoutSubtotalCents > 0 && checkoutTaxCents > 0
          ? Math.round((checkoutTaxCents * clientLineHtCents) / checkoutSubtotalCents)
          : 0
      const lineTotalCents = clientLineHtCents + lineTaxCents
      const variantImageUrl =
        resolveMarketplaceOrderLineImageUrl(listing, checkoutVariantLabel, checkoutVariantSignature) ||
        null

      await tx.order.update({
        where: { id: pendingOrder.id },
        data: {
          buyerUserId: earnUserId || null,
          buyerLocale: buyerLocale || undefined,
          listingKindSnapshot: listing.product.listingKind.trim().toUpperCase(),
          customerEmail,
          ...(stripePhone ? { customerPhone: stripePhone } : {}),
          shippingAddress,
          quantity: qty,
          variantLabel: checkoutVariantLabel || null,
          variantImageUrl,
          basePriceCents,
          sellingPriceCents: settlement.sellingPriceCents,
          marginCents: settlement.marginCents,
          commissionCents: settlement.affiliateCommissionCents,
          affiliatePayoutCents: settlement.affiliateCommissionCents,
          affisellFeeCents: dupPhase1Fees.affisellFeeTotalCents,
          supplierFeeCents: dupPhase1Fees.supplierFeeCents,
          affiliateFeeCents: dupPhase1Fees.affiliateFeeCents,
          aeWholesaleCents: dupAeWholesale,
          upstreamCogsCents: dupEscrow.upstreamCogsCents,
          supplierMarginCents: dupEscrow.supplierMarginCents,
          usesAffisellAutoBuy: dupUsesAutoBuy,
          affiliateMarginRetainedCents: dupAffiliateMargin,
          supplierPriceCents: basePriceCents,
          supplierCommissionRateBps,
          supplierPayoutCents: dupSupplierNetPayout,
          affiliateMarginCents: dupAffiliateMargin,
          pricingFreedom: true,
          affisellCommissionRateBps,
          status: "paid",
          paidAt: new Date(),
          shipDeadlineAt: computeShipDeadlineAtForRoute(
            new Date(),
            listing.product.shippingCountry,
            extractShippingCountryIso2FromAddress(shippingAddress)
          ),
          fulfillmentStatus: "PENDING",
          subtotalCents: settlement.affisellFeeBaseCents,
          taxCents: lineTaxCents,
          totalCents: lineTotalCents,
          paymentSettlementStatus: "PENDING",
          currency: checkoutCurrency.toUpperCase(),
          affiliateStripeAccountId: listing.affiliate.stripeAccountId?.trim() || null,
        },
      })

      await tx.affiliateProduct.update({
        where: { id: listing.id },
        data: { conversions: { increment: qty } },
      })

      await recordAffiliateSaleFromOrder(tx, {
        id: pendingOrder.id,
        affiliateId: listing.affiliateId,
        supplierId: listing.product.supplierId,
        supplierPriceCents: basePriceCents,
        affiliateMarginCents: dupAffiliateMargin,
        affiliatePayoutCents: settlement.affiliateCommissionCents,
        sellingPriceCents: settlement.sellingPriceCents,
      })

      const variantBit = checkoutVariantLabel ? ` · ${checkoutVariantLabel}` : ""
      const pendingOrderSnapshot = await tx.order.findUnique({
        where: { id: pendingOrder.id },
        select: {
          subtotalCents: true,
          sellingPriceCents: true,
          totalCents: true,
          taxCents: true,
          supplierPriceCents: true,
          basePriceCents: true,
          marginCents: true,
          affisellFeeCents: true,
          commissionCents: true,
          affiliatePayoutCents: true,
          affiliateMarginRetainedCents: true,
          affiliateFeeCents: true,
          supplierPayoutCents: true,
          supplierFeeCents: true,
        },
      })
      await createMarketplaceOrderNotifications(tx, {
        orderId: pendingOrder.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        productName: listing.product.name,
        variantBit,
        qty,
        customerEmail,
        partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
        settlement: pendingOrderSnapshot
          ? affiliateNotificationSettlementFromOrder(pendingOrderSnapshot)
          : affiliateSaleNotificationSettlement(settlement, {
              affiliateMarginRetainedCents: dupAffiliateMargin,
              affiliatePlatformFeeCents: dupPhase1Fees.affiliateFeeCents,
            }),
        supplierNetCents: pendingOrderSnapshot?.supplierPayoutCents ?? dupSupplierNetPayout,
        supplierPlatformFeeCents:
          pendingOrderSnapshot?.supplierFeeCents ?? dupPhase1Fees.supplierFeeCents,
        usesAffisellAutoBuy: dupUsesAutoBuy,
        taxCents: pendingOrderSnapshot?.taxCents ?? lineTaxCents,
        totalCents: pendingOrderSnapshot?.totalCents ?? lineTotalCents,
        imageUrl: variantImageUrl,
      })

      const productImageUrl = resolveOrderConfirmationImageUrl({
        productImages: listing.product.images,
        customImages: listing.customImages,
        variantImageUrl,
      })
      const shippingName =
        shippingAddress &&
        typeof shippingAddress === "object" &&
        !Array.isArray(shippingAddress) &&
        typeof (shippingAddress as Record<string, unknown>).name === "string"
          ? ((shippingAddress as Record<string, unknown>).name as string).trim()
          : undefined

      deferred.confirmation = {
        orderId: pendingOrder.id,
        productName: listing.product.name,
        productImageUrl,
        quantity: qty,
        total: (paidLineCents / 100).toFixed(2),
        currency: checkoutCurrency,
        customerEmail,
        customerName: shippingName,
        locale: buyerLocale,
        affiliateId: listing.affiliateId,
      }

      await runInstantDigitalDeliveryAfterPayment(tx, {
        orderId: pendingOrder.id,
        customerEmail,
        buyerUserId: earnUserId || null,
        buyerLocale,
        product: listing.product,
      })

      await runBookingPassAfterPaymentForOrder(tx, {
        orderId: pendingOrder.id,
        quantity: qty,
        buyerUserId: earnUserId || null,
        buyerLocale,
        customerEmail,
        product: listing.product,
      })

      await attachOrderCgvAcceptance(tx, {
        orderId: pendingOrder.id,
        userId: earnUserId || null,
        buyerEmail: customerEmail,
        locale: buyerLocale,
      })

      await syncMarketplaceOrderToMedusa(tx, {
        orderId: pendingOrder.id,
        medusaOrderId: pendingOrder.medusaOrderId,
        productId: listing.productId,
        productName: listing.product.name,
        quantity: qty,
        linePriceCents: clientLineHtCents,
        customerEmail,
        shippingAddress: shippingAddress as Prisma.JsonValue,
        stripeSessionId: sessionId,
        currency: checkoutCurrency,
        buyerUserId: earnUserId || null,
      })

      if (earnUserId) {
        const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
        await earnBuyerRewardIdempotent(tx, {
          userId: earnUserId,
          amountCents: earn,
          stripeSessionId: sessionId,
          affiliateProductId: listing.id,
          orderId: pendingOrder.id,
        })
      }

      fulfilledOrderIds.push(pendingOrder.id)
      return
    }

    const orderId = await createPaidMarketplaceOrder(tx, {
      stripeSessionId: sessionId,
      listing,
      qty,
      paidLineCents,
      buyerUserId: earnUserId || null,
      customerEmail,
      shippingAddress,
      variantLabel: checkoutVariantLabel,
      variantSignature: checkoutVariantSignature,
      partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
      checkoutAmountTotal,
      checkoutSubtotalCents,
      checkoutTaxCents,
      checkoutCurrency,
      buyerLocale,
      onUnallocated: (u) =>
        unallocated.push({
          lineIndex: 0,
          reason: u.reason,
          affiliateProductId: listing.id,
          productId: listing.productId,
          qty,
          paidLineCents,
          detail: u.detail,
        }),
      deferConfirmation: (payload) => {
        deferred.confirmation = payload
      },
    })

    if (orderId) {
      await redeemBuyerRewardOrSkip(tx, {
        userId: buyerUserId,
        amountCents: appliedRewardCents,
        stripeSessionId: sessionId,
      })
    }

    if (earnUserId && orderId) {
      const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
      await earnBuyerRewardIdempotent(tx, {
        userId: earnUserId,
        amountCents: earn,
        stripeSessionId: sessionId,
        affiliateProductId: listing.id,
        orderId,
      })
    }

    if (orderId) fulfilledOrderIds.push(orderId)
  }, MARKETPLACE_FULFILL_TX_OPTIONS)

  // D6 / G1: a paid line that produced no order is traced, alerted and (only when enabled) refunded.
  if (unallocated.length > 0) {
    await runAfterResponse("unallocated_lines_single", () =>
      recordUnallocatedLines({ session, lines: unallocated, appliedRewardCents })
    )
  }

  scheduleMerchantOrderAlerts(fulfilledOrderIds)

  await runAfterResponse("post_fulfill_effects", async () => {
    if (deferred.confirmation) {
      const confirmationPayload = deferred.confirmation
      try {
        await sendOrderConfirmationEmail(confirmationPayload)
      } catch (e) {
        logStripeWebhookError({
          metric: "order_confirmation_email_failed",
          orderId: confirmationPayload.orderId,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    try {
      await triggerAutoFulfillmentForStripeSession(sessionId)
    } catch (e) {
      console.error("[auto-order] trigger after fulfill failed", e)
    }
    try {
      await triggerAutoDsForStripeSession(sessionId)
    } catch (e) {
      console.error("[autods] trigger after fulfill failed", e)
    }
  })
}
