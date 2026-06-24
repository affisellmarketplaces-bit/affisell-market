import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { resolveMarketplaceOrderLineImageUrl } from "@/lib/cart-line-image"
import { formatCartVariantLabel, parseCartVariantSignature } from "@/lib/cart-variant"
import { buyerEarnCentsForLinePaid } from "@/lib/buyer-reward-earn"
import { earnBuyerRewardIdempotent, redeemBuyerRewardIdempotent } from "@/lib/buyer-reward-ledger"
import { ensureBuyerUserIdFromStripeCheckout } from "@/lib/ensure-buyer-from-stripe-checkout"
import { resolveBuyerUserIdForEarn } from "@/lib/buyer-reward-resolve-user"
import { resolveAffisellCommissionRateBpsForProductId } from "@/lib/affisell-platform-commission.server"
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
import { computeShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"
import { applyInstantDigitalDeliveryInTransaction } from "@/lib/digital-delivery/instant-fulfill"
import { sendDigitalAccessPassEmail } from "@/lib/emails/send-digital-access-pass"
import { runBookingPassAfterPayment } from "@/lib/booking/run-after-payment"
import { logStripeWebhookError } from "@/lib/stripe-webhook-observability"
import {
  resolveOrderConfirmationImageUrl,
  sendOrderConfirmationEmail,
} from "@/lib/emails/send-order-confirmation"
import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"
import { healMarketplaceOrderNotifications } from "@/lib/marketplace-order-notification-heal"
import { syncMarketplaceOrderToMedusa, syncMarketplaceOrderToMedusaIfNeeded } from "@/lib/medusa/sync-marketplace-order"
import { prisma } from "@/lib/prisma"
import {
  marketplaceSellingPriceCentsForOption,
  marketplaceWholesaleCentsForOption,
  variantsFromDb,
} from "@/lib/product-variants"

type Tx = Prisma.TransactionClient

const MARKETPLACE_FULFILL_TX_OPTIONS = { timeout: 60_000, maxWait: 15_000 } as const

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
  }
): Promise<string | null> {
  const { listing, qty } = args
  const variants = variantsFromDb(listing.product.variants)
  const parsed = parseCartVariantSignature(args.variantSignature ?? "")
  const optionName = parsed.color || args.variantLabel.split("·")[0]?.trim() || null
  const variantImageUrl =
    resolveMarketplaceOrderLineImageUrl(listing, args.variantLabel, args.variantSignature) || null
  const basePriceCents =
    marketplaceWholesaleCentsForOption({
      productBasePriceCents: listing.product.basePriceCents,
      variants,
      optionName,
    }) * qty
  const supplierCommissionRateBps = await resolveSupplierCommissionRateBpsForProductId({
    productId: listing.productId,
    optionName,
    variants,
  })
  const affisellCommissionRateBps = await resolveAffisellCommissionRateBpsForProductId(
    listing.productId
  )
  const lineAffiliateMarginCents =
    listing.marginCents > 0 ? listing.marginCents * qty : undefined
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

  const grossAffiliateMarkupCents =
    lineAffiliateMarginCents ??
    Math.max(0, clientLineHtCents - basePriceCents - settlement.affiliateCommissionCents)

  const phase1Fees = buildPhase1FeesForOrderLine({
    usesAffisellAutoBuy,
    supplier: listing.product.supplier,
    supplierPriceCents: basePriceCents,
    aeWholesaleCents,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: grossAffiliateMarkupCents,
    affiliatePlatformFeeBps: listing.affiliate.affiliatePlatformFeeBps,
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
  const affiliateMarginCents =
    listing.marginCents > 0
      ? listing.marginCents
      : Math.max(0, unitSupplierCents > 0 ? Math.round(affiliateMarginRetainedCents / qty) : 0)

  const order = await tx.order.create({
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
      affiliateMarginCents: affiliateMarginCents * qty,
      affisellCommissionRateBps,
      status: "paid",
      paidAt: new Date(),
      shipDeadlineAt: computeShipDeadlineAt(new Date()),
      fulfillmentStatus: "PENDING",
      subtotalCents: settlement.affisellFeeBaseCents,
      taxCents: lineTaxCents,
      totalCents: lineTotalCents,
      paymentSettlementStatus: "PENDING",
      affiliateStripeAccountId: listing.affiliate.stripeAccountId?.trim() || null,
      currency: args.checkoutCurrency.toUpperCase(),
    },
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

  const variantBit = args.variantLabel ? ` · ${args.variantLabel}` : ""
  await createMarketplaceOrderNotifications(tx, {
    orderId: order.id,
    supplierId: listing.product.supplierId,
    affiliateId: listing.affiliateId,
    productName: listing.product.name,
    variantBit,
    qty,
    customerEmail: args.customerEmail,
    partnerListingCode: args.partnerListingCode,
    settlement: affiliateSaleNotificationSettlement(settlement, {
      affiliateMarginRetainedCents,
      affiliatePlatformFeeCents: phase1Fees.affiliateFeeCents,
    }),
    supplierNetCents: supplierNetPayoutCents,
    supplierPlatformFeeCents: phase1Fees.supplierFeeCents,
    usesAffisellAutoBuy,
    taxCents: lineTaxCents,
    totalCents: lineTotalCents,
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

  try {
    await sendOrderConfirmationEmail({
      orderId: order.id,
      productName: listing.product.name,
      productImageUrl,
      quantity: qty,
      total: (args.paidLineCents / 100).toFixed(2),
      currency: args.checkoutCurrency,
      customerEmail: args.customerEmail,
      customerName: shippingName,
      locale: args.buyerLocale,
    })
  } catch (e) {
    logStripeWebhookError({
      metric: "order_confirmation_email_failed",
      orderId: order.id,
      error: e instanceof Error ? e.message : String(e),
    })
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

  return order.id
}

function scheduleMerchantOrderAlerts(orderIds: string[]): void {
  for (const orderId of new Set(orderIds)) {
    void dispatchMerchantOrderAlerts(orderId)
    void healMarketplaceOrderNotifications(orderId)
  }
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

    await prisma.$transaction(async (tx) => {
      const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

      await redeemBuyerRewardOrSkip(tx, {
        userId: buyerUserId,
        amountCents: appliedRewardCents,
        stripeSessionId: sessionId,
      })

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const stripeSessionId = `${sessionId}:line:${i}`
        const dup = await tx.order.findUnique({ where: { stripeSessionId } })
        if (dup?.status === "paid") {
          fulfilledOrderIds.push(dup.id)
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
          continue
        }
        if (!fulfillingPreCreated && !listing.product.active) {
          console.log("[marketplace-fulfill]", {
            sessionId,
            line: i,
            affiliateProductId: line.affiliateProductId,
            result: "skipped_inactive_listing",
          })
          continue
        }

        const sigStr = typeof line.variantSignature === "string" ? line.variantSignature : ""
        const parsed = parseCartVariantSignature(sigStr)
        const variants = variantsFromDb(listing.product.variants)
        const optionName = parsed.color || null
        const listLineCents =
          marketplaceSellingPriceCentsForOption({
            listingSellingPriceCents: listing.sellingPriceCents,
            productBasePriceCents: listing.product.basePriceCents,
            variants,
            optionName,
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
    }, MARKETPLACE_FULFILL_TX_OPTIONS)

    scheduleMerchantOrderAlerts(fulfilledOrderIds)

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
    return
  }

  const metaOrderId = meta.orderId?.trim() || ""
  let existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId } })
  if (!existing && metaOrderId) {
    existing = await prisma.order.findUnique({ where: { id: metaOrderId } })
  }
  if (existing?.status === "paid") {
    await syncMarketplaceOrderToMedusaIfNeeded(existing.id)
    scheduleMerchantOrderAlerts([existing.id])
    try {
      await triggerAutoDsForStripeSession(sessionId)
    } catch (e) {
      console.error("[autods] trigger after existing paid order failed", e)
    }
    return
  }

  const affiliateProductId =
    meta.affiliateProductId?.trim() || existing?.affiliateProductId?.trim() || ""
  if (!affiliateProductId) {
    console.log("[marketplace-fulfill]", { sessionId, result: "skipped_no_listing_id" })
    return
  }

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
    return
  }

  const fulfillingPreCreated = existing?.status === "PENDING"
  if (!fulfillingPreCreated && !listing.product.active) {
    console.log("[marketplace-fulfill]", {
      sessionId,
      affiliateProductId,
      result: "skipped_inactive_listing",
    })
    return
  }

  const qty = Math.max(
    1,
    Math.round(parseInt(meta.checkoutQty ?? String(existing?.quantity ?? 1), 10) || 1)
  )
  const checkoutVariantLabel =
    meta.checkoutVariantLabel?.trim() || existing?.variantLabel?.trim() || ""
  const checkoutVariantSignature = meta.checkoutVariantSignature?.trim() || ""
  const variants = variantsFromDb(listing.product.variants)
  const checkoutParsed = parseCartVariantSignature(checkoutVariantSignature)
  const optionName = checkoutParsed.color || checkoutVariantLabel.split("·")[0]?.trim() || null
  const listLineCents =
    marketplaceSellingPriceCentsForOption({
      listingSellingPriceCents: listing.sellingPriceCents,
      productBasePriceCents: listing.product.basePriceCents,
      variants,
      optionName,
    }) * qty
  const paids = linePaids
  const paidLineCents =
    paids && paids.length >= 1 ? Math.min(listLineCents, Math.max(0, paids[0]!)) : listLineCents

  const deferred = {
    confirmation: null as OrderConfirmationEmailPayload | null,
  }
  const fulfilledOrderIds: string[] = []

  await prisma.$transaction(async (tx) => {
    let dup = await tx.order.findUnique({ where: { stripeSessionId: sessionId } })
    if (!dup && metaOrderId) {
      dup = await tx.order.findUnique({ where: { id: metaOrderId } })
    }
    if (dup && dup.stripeSessionId !== sessionId) {
      dup = await tx.order.update({
        where: { id: dup.id },
        data: { stripeSessionId: sessionId },
      })
    }
    if (dup?.status === "paid") {
      fulfilledOrderIds.push(dup.id)
      return
    }

    const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

    await redeemBuyerRewardOrSkip(tx, {
      userId: buyerUserId,
      amountCents: appliedRewardCents,
      stripeSessionId: sessionId,
    })

    const recoverCancelledBooking =
      dup?.status === "CANCELLED" &&
      Boolean(dup.bookingSlotId) &&
      !dup.bookingConfirmedAt

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
      const settlement = computeMarketplaceOrderSettlement({
        sellingPriceCents: clientLineHtCents,
        supplierPriceCents: basePriceCents,
        supplierCommissionRateBps,
        affiliateMarginCents: listing.marginCents > 0 ? listing.marginCents * qty : undefined,
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
      const dupGrossMarkup =
        listing.marginCents > 0
          ? listing.marginCents * qty
          : Math.max(0, clientLineHtCents - basePriceCents - settlement.affiliateCommissionCents)
      const dupPhase1Fees = buildPhase1FeesForOrderLine({
        usesAffisellAutoBuy: dupUsesAutoBuy,
        supplier: listing.product.supplier,
        supplierPriceCents: basePriceCents,
        aeWholesaleCents: dupAeWholesale,
        affiliateCommissionCents: settlement.affiliateCommissionCents,
        affiliateMarginRetainedCents: dupGrossMarkup,
        affiliatePlatformFeeBps: listing.affiliate.affiliatePlatformFeeBps,
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
        fixedListingMarginCents: listing.marginCents > 0 ? listing.marginCents * qty : undefined,
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
          affiliateMarginCents:
            listing.marginCents > 0 ? listing.marginCents * qty : settlement.affiliateMarginRetainedCents,
          affisellCommissionRateBps,
          status: "paid",
          paidAt: new Date(),
          shipDeadlineAt: computeShipDeadlineAt(new Date()),
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

      const variantBit = checkoutVariantLabel ? ` · ${checkoutVariantLabel}` : ""
      await createMarketplaceOrderNotifications(tx, {
        orderId: pendingOrder.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        productName: listing.product.name,
        variantBit,
        qty,
        customerEmail,
        partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
        settlement: affiliateSaleNotificationSettlement(settlement, {
          affiliateMarginRetainedCents: dupAffiliateMargin,
          affiliatePlatformFeeCents: dupPhase1Fees.affiliateFeeCents,
        }),
        supplierNetCents: dupSupplierNetPayout,
        supplierPlatformFeeCents: dupPhase1Fees.supplierFeeCents,
        usesAffisellAutoBuy: dupUsesAutoBuy,
        taxCents: lineTaxCents,
        totalCents: lineTotalCents,
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
  }, MARKETPLACE_FULFILL_TX_OPTIONS)

  scheduleMerchantOrderAlerts(fulfilledOrderIds)

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
}
