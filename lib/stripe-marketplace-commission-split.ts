import type Stripe from "stripe"

import { calculateThreeWaySplit } from "@/lib/marketplace-order-settlement"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

function affisellCommissionRateBpsFromEnv(): number {
  const raw = process.env.AFFISELL_COMMISSION_BPS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 1200
  return Number.isFinite(n) && n >= 0 ? n : 1200
}

function resolveThreeWayInput(order: {
  supplierPriceCents: number
  supplierCommissionRateBps: number
  affiliateMarginCents: number
  affisellCommissionRateBps: number
  basePriceCents: number
  sellingPriceCents: number
  marginCents: number
  quantity: number
}) {
  const qty = Math.max(1, order.quantity)
  const supplierPriceCents =
    order.supplierPriceCents > 0 ? order.supplierPriceCents : order.basePriceCents * qty
  const affiliateMarginCents =
    order.affiliateMarginCents > 0
      ? order.affiliateMarginCents
      : Math.max(0, order.marginCents || order.sellingPriceCents - order.basePriceCents * qty)
  return {
    supplierPriceCents,
    supplierCommissionRateBps:
      order.supplierCommissionRateBps > 0 ? order.supplierCommissionRateBps : 1000,
    affiliateMarginCents,
    affisellCommissionRateBps:
      order.affisellCommissionRateBps > 0
        ? order.affisellCommissionRateBps
        : affisellCommissionRateBpsFromEnv(),
  }
}

function resolveConnectDestination(
  supplierStripeAccountId: string | null | undefined,
  sellerIdFromMeta: string | null | undefined,
  orderSupplierId: string
): string | null {
  const fromSupplier = supplierStripeAccountId?.trim()
  if (fromSupplier) return fromSupplier

  const fromEnv =
    process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID?.trim() ||
    process.env.TEST_STRIPE_CONNECT_ACCOUNT_ID?.trim()
  if (fromEnv) {
    console.log("webhook: using TEST_SUPPLIER_STRIPE_ACCOUNT_ID fallback", {
      orderSupplierId,
      sellerIdFromMeta,
      destination: fromEnv,
    })
    return fromEnv
  }

  return null
}

async function stripeFeeCentsFromCharge(stripe: Stripe, charge: Stripe.Charge): Promise<number> {
  const btRef = charge.balance_transaction
  if (!btRef) return 0
  if (typeof btRef === "object" && btRef !== null && "fee" in btRef) {
    return Math.max(0, btRef.fee ?? 0)
  }
  const btId = typeof btRef === "string" ? btRef : null
  if (!btId) return 0
  const bt = await stripe.balanceTransactions.retrieve(btId)
  return Math.max(0, bt.fee ?? 0)
}

export async function findOrderIdsForCheckoutSession(sessionId: string): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeSessionId: { startsWith: `${sessionId}:line:` } }],
    },
    select: { id: true, sellingPriceCents: true },
  })
  return orders.map((o) => o.id)
}

async function resolveChargeForPaymentIntent(
  stripe: Stripe,
  pi: Stripe.PaymentIntent
): Promise<Stripe.Charge | null> {
  const latest = pi.latest_charge
  const chargeId = typeof latest === "string" ? latest : latest?.id
  if (!chargeId) return null
  return stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] })
}

async function retrieveCheckoutSessionForSettlement(
  sessionOrId: Stripe.Checkout.Session | string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient()
  const sessionId = typeof sessionOrId === "string" ? sessionOrId : sessionOrId.id
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["total_details.breakdown", "payment_intent"],
  })
}

function allocateSessionAmounts(
  session: Stripe.Checkout.Session,
  orders: { id: string; sellingPriceCents: number }[],
  stripeFeeCents: number
): Map<
  string,
  { subtotalCents: number; taxCents: number; totalCents: number; stripeFeeCents: number }
> {
  const sessionSubtotal = session.amount_subtotal ?? 0
  const sessionTax = session.total_details?.amount_tax ?? 0
  const sessionTotal = session.amount_total ?? 0
  const weightSum = orders.reduce((s, o) => s + Math.max(0, o.sellingPriceCents), 0)
  const map = new Map<
    string,
    { subtotalCents: number; taxCents: number; totalCents: number; stripeFeeCents: number }
  >()

  for (const order of orders) {
    const weight =
      weightSum > 0 ? Math.max(0, order.sellingPriceCents) / weightSum : 1 / Math.max(1, orders.length)
    map.set(order.id, {
      subtotalCents: Math.round(sessionSubtotal * weight),
      taxCents: Math.round(sessionTax * weight),
      totalCents: Math.round(sessionTotal * weight),
      stripeFeeCents: Math.round(stripeFeeCents * weight),
    })
  }
  return map
}

/**
 * Settle marketplace orders after Stripe Tax checkout: HT commission + Connect transfer.
 */
export async function settleMarketplaceOrdersFromCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  const stripe = getStripeClient()
  const session = await retrieveCheckoutSessionForSettlement(sessionOrId)
  const defaultAffisellBps = affisellCommissionRateBpsFromEnv()

  console.log("webhook: settleMarketplaceOrdersFromCheckoutSession", {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    amountSubtotal: session.amount_subtotal,
    amountTax: session.total_details?.amount_tax,
    amountTotal: session.amount_total,
  })

  if (session.payment_status !== "paid") {
    return { processedOrderIds: [], errors: ["session_not_paid"] }
  }

  const piRef = session.payment_intent
  const piId = typeof piRef === "string" ? piRef : piRef?.id
  if (!piId) {
    console.log("webhook: no payment_intent on session", { sessionId: session.id })
    return { processedOrderIds: [], errors: ["missing_payment_intent"] }
  }

  const paymentIntent =
    typeof piRef === "object" && piRef !== null
      ? piRef
      : await stripe.paymentIntents.retrieve(piId)

  const charge = await resolveChargeForPaymentIntent(stripe, paymentIntent)
  if (!charge) {
    console.log("webhook: missing charge for payment_intent", { paymentIntentId: piId })
    return { processedOrderIds: [], errors: ["missing_charge"] }
  }

  const stripeFeeCents = await stripeFeeCentsFromCharge(stripe, charge)
  const sellerIdMeta =
    session.metadata?.sellerId?.trim() || session.metadata?.supplierId?.trim() || null

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: session.id }, { stripeSessionId: { startsWith: `${session.id}:line:` } }],
    },
    include: {
      supplier: { select: { id: true, stripeAccountId: true, email: true } },
      affiliate: { select: { id: true, stripeAccountId: true, email: true } },
    },
  })

  if (orders.length === 0) {
    console.log("webhook: no orders for session", { sessionId: session.id })
    return { processedOrderIds: [], errors: ["orders_not_found"] }
  }

  const amountsByOrder = allocateSessionAmounts(
    session,
    orders.map((o) => ({ id: o.id, sellingPriceCents: o.sellingPriceCents })),
    stripeFeeCents
  )

  const processedOrderIds: string[] = []
  const errors: string[] = []

  for (const order of orders) {
    if (order.stripeTransferId) {
      console.log("webhook: order already settled", { orderId: order.id, transferId: order.stripeTransferId })
      processedOrderIds.push(order.id)
      continue
    }

    const allocated = amountsByOrder.get(order.id)
    const taxCents = allocated?.taxCents ?? session.total_details?.amount_tax ?? 0
    const orderStripeFee = allocated?.stripeFeeCents ?? stripeFeeCents

    const threeWayInput = resolveThreeWayInput(order)
    const split = calculateThreeWaySplit({
      ...threeWayInput,
      stripeFeeCents: orderStripeFee,
    })

    const supplierConnectId =
      order.supplier.stripeAccountId?.trim() ||
      resolveConnectDestination(null, sellerIdMeta, order.supplierId)

    const affiliateConnectId =
      order.affiliateStripeAccountId?.trim() ||
      order.affiliate?.stripeAccountId?.trim() ||
      process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim() ||
      null

    console.log("split:", {
      orderId: order.id,
      metric: "commission_calculated",
      ...threeWayInput,
      taxCents,
      totalClientCents: split.totalClientCents,
      affisellFeeCents: split.affisellFeeCents,
      supplierPayoutCents: split.supplierPayoutCents,
      affiliatePayoutCents: split.affiliatePayoutCents,
      stripeFeeCents: orderStripeFee,
      affisellNetCents: split.affisellNetCents,
    })

    if (!supplierConnectId && split.supplierPayoutCents > 0) {
      console.warn("webhook: skip_transfer_no_seller_account", {
        orderId: order.id,
        supplierId: order.supplierId,
        supplierEmail: order.supplier.email,
      })
    }

    let stripeTransferId: string | null = null
    try {
      // Transfer Supplier
      if (split.supplierPayoutCents > 0 && supplierConnectId) {
        const supplierTransfer = await stripe.transfers.create({
          amount: split.supplierPayoutCents,
          currency: "eur",
          destination: supplierConnectId,
          source_transaction: charge.id,
          transfer_group: order.id,
          metadata: { orderId: order.id, role: "supplier" },
        })
        stripeTransferId = supplierTransfer.id
        console.log("transfer_created:", {
          orderId: order.id,
          role: "supplier",
          transferId: supplierTransfer.id,
          amount: split.supplierPayoutCents,
          destination: supplierConnectId,
        })
      }
      // Transfer Affiliate
      if (split.affiliatePayoutCents > 0 && affiliateConnectId) {
        const affiliateTransfer = await stripe.transfers.create({
          amount: split.affiliatePayoutCents,
          currency: "eur",
          destination: affiliateConnectId,
          source_transaction: charge.id,
          transfer_group: order.id,
          metadata: { orderId: order.id, role: "affiliate" },
        })
        console.log("transfer_created:", {
          orderId: order.id,
          role: "affiliate",
          transferId: affiliateTransfer.id,
          amount: split.affiliatePayoutCents,
          destination: affiliateConnectId,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "transfer_failed"
      console.error("webhook: transfer_failed", { orderId: order.id, error: msg })
      errors.push(`${order.id}:${msg}`)
      continue
    }

    const totalCentsWithTax = split.totalClientCents + taxCents

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: charge.id,
        subtotalCents: threeWayInput.supplierPriceCents + threeWayInput.affiliateMarginCents,
        taxCents,
        totalCents: totalCentsWithTax,
        supplierPriceCents: threeWayInput.supplierPriceCents,
        supplierCommissionRateBps: threeWayInput.supplierCommissionRateBps,
        affiliateMarginCents: threeWayInput.affiliateMarginCents,
        affisellCommissionRateBps: threeWayInput.affisellCommissionRateBps,
        platformCommissionRate: threeWayInput.affisellCommissionRateBps / 10_000,
        platformCommissionCents: split.affisellFeeCents,
        affisellFeeCents: split.affisellFeeCents,
        stripeFeesCents: split.stripeFeeCents,
        supplierPayoutCents: split.supplierPayoutCents,
        affiliatePayoutCents: split.affiliatePayoutCents,
        sellerPayoutCents: split.supplierPayoutCents,
        affiliateStripeAccountId: affiliateConnectId,
        currency: (order.currency ?? paymentIntent.currency ?? "eur").toUpperCase(),
        paymentSettlementStatus: stripeTransferId ? "SETTLED" : "PAID",
        stripeTransferId,
        paidAt: order.paidAt ?? new Date(),
      },
    })

    if (!order.supplier.stripeAccountId?.trim() && supplierConnectId) {
      await prisma.user.updateMany({
        where: { id: order.supplierId, stripeAccountId: null },
        data: { stripeAccountId: supplierConnectId },
      })
    }

    processedOrderIds.push(order.id)
  }

  return { processedOrderIds, errors }
}

async function checkoutSessionIdForPaymentIntent(
  paymentIntentId: string
): Promise<string | null> {
  const stripe = getStripeClient()
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 5,
  })
  return sessions.data[0]?.id ?? null
}

export async function processMarketplaceCommissionForPaymentIntent(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  if (paymentIntent.metadata?.flow === "blind_dropship") {
    return { processedOrderIds: [], errors: [] }
  }

  console.log("webhook: payment_intent.succeeded", { paymentIntentId: paymentIntent.id })

  const sessionId = await checkoutSessionIdForPaymentIntent(paymentIntent.id)
  if (sessionId) {
    const orderIds = await findOrderIdsForCheckoutSession(sessionId)
    if (orderIds.length > 0) {
      return settleMarketplaceOrdersFromCheckoutSession(sessionId)
    }
    console.log("webhook: session found but orders not ready yet", { sessionId })
  }

  const ordersByPi = await prisma.order.findMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { stripeSessionId: true },
  })
  const sessionFromOrder = ordersByPi.find((o) => o.stripeSessionId)?.stripeSessionId
  if (sessionFromOrder) {
    const baseSessionId = sessionFromOrder.split(":line:")[0] ?? sessionFromOrder
    return settleMarketplaceOrdersFromCheckoutSession(baseSessionId)
  }

  return { processedOrderIds: [], errors: ["no_session_or_orders"] }
}

function isSimulatedChargeId(chargeId: string | null | undefined): boolean {
  return Boolean(chargeId?.startsWith("ch_test_"))
}

/**
 * Settle one order (three-way split). Used by scripts/settle-order.ts and webhooks.
 */
export async function handleStripeCommissionSplit(
  _session: Stripe.Checkout.Session,
  orderId: string
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      supplier: { select: { id: true, stripeAccountId: true, email: true } },
      affiliate: { select: { id: true, stripeAccountId: true, email: true } },
    },
  })

  if (!order) {
    console.log("webhook: order not found", { orderId })
    return { processedOrderIds: [], errors: ["order_not_found"] }
  }

  if (order.stripeTransferId) {
    console.log("webhook: order already settled", { orderId, transferId: order.stripeTransferId })
    return { processedOrderIds: [orderId], errors: [] }
  }

  const stripe = getStripeClient()
  const orderStripeFee = order.stripeFeesCents > 0 ? order.stripeFeesCents : 50
  const threeWayInput = resolveThreeWayInput(order)
  const split = calculateThreeWaySplit({
    ...threeWayInput,
    stripeFeeCents: orderStripeFee,
  })

  console.log("three_way_split:", {
    orderId: order.id,
    metric: "three_way_split",
    ...threeWayInput,
    totalClientCents: split.totalClientCents,
    priceClientCents: split.priceClientCents,
    affisellFeeCents: split.affisellFeeCents,
    supplierPayoutCents: split.supplierPayoutCents,
    affiliatePayoutCents: split.affiliatePayoutCents,
    supplierCommissionToAffiliateCents: split.supplierCommissionToAffiliateCents,
    affisellNetCents: split.affisellNetCents,
  })

  const supplierConnectId =
    order.supplier.stripeAccountId?.trim() ||
    process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID?.trim() ||
    null

  const affiliateConnectId =
    order.affiliateStripeAccountId?.trim() ||
    order.affiliate?.stripeAccountId?.trim() ||
    process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim() ||
    null

  const chargeId = order.stripeChargeId
  const simulated = isSimulatedChargeId(chargeId)
  let stripeTransferId: string | null = null

  try {
    if (split.supplierPayoutCents > 0 && supplierConnectId) {
      if (simulated) {
        stripeTransferId = `tr_test_supplier_${order.id}`
        console.log("transfer_created:", {
          orderId: order.id,
          role: "supplier",
          transferId: stripeTransferId,
          amount: split.supplierPayoutCents,
          destination: supplierConnectId,
          simulated: true,
        })
      } else if (chargeId) {
        const supplierTransfer = await stripe.transfers.create({
          amount: split.supplierPayoutCents,
          currency: "eur",
          destination: supplierConnectId,
          source_transaction: chargeId,
          transfer_group: order.id,
          metadata: { orderId: order.id, role: "supplier" },
        })
        stripeTransferId = supplierTransfer.id
        console.log("transfer_created:", {
          orderId: order.id,
          role: "supplier",
          transferId: supplierTransfer.id,
          amount: split.supplierPayoutCents,
          destination: supplierConnectId,
        })
      }
    }

    if (split.affiliatePayoutCents > 0 && affiliateConnectId) {
      if (simulated) {
        console.log("transfer_created:", {
          orderId: order.id,
          role: "affiliate",
          transferId: `tr_test_affiliate_${order.id}`,
          amount: split.affiliatePayoutCents,
          destination: affiliateConnectId,
          simulated: true,
        })
      } else if (chargeId) {
        const affiliateTransfer = await stripe.transfers.create({
          amount: split.affiliatePayoutCents,
          currency: "eur",
          destination: affiliateConnectId,
          source_transaction: chargeId,
          transfer_group: order.id,
          metadata: { orderId: order.id, role: "affiliate" },
        })
        console.log("transfer_created:", {
          orderId: order.id,
          role: "affiliate",
          transferId: affiliateTransfer.id,
          amount: split.affiliatePayoutCents,
          destination: affiliateConnectId,
        })
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "transfer_failed"
    console.error("webhook: transfer_failed", { orderId: order.id, error: msg })
    return { processedOrderIds: [], errors: [`${orderId}:${msg}`] }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      supplierPriceCents: threeWayInput.supplierPriceCents,
      supplierCommissionRateBps: threeWayInput.supplierCommissionRateBps,
      affiliateMarginCents: threeWayInput.affiliateMarginCents,
      affisellCommissionRateBps: threeWayInput.affisellCommissionRateBps,
      totalCents: split.totalClientCents,
      supplierPayoutCents: split.supplierPayoutCents,
      affiliatePayoutCents: split.affiliatePayoutCents,
      affisellFeeCents: split.affisellFeeCents,
      platformCommissionCents: split.affisellFeeCents,
      stripeFeesCents: split.stripeFeeCents,
      affiliateStripeAccountId: affiliateConnectId,
      paymentSettlementStatus: "SETTLED",
      stripeTransferId,
    },
  })

  return { processedOrderIds: [orderId], errors: [] }
}
