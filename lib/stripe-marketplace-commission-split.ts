import Stripe from "stripe"

import { calculateThreeWaySplit } from "./marketplace-order-settlement"
import { prisma } from "./prisma"
import { getStripeClient } from "./stripe"

export async function handleStripeCommissionSplit(
  session: Stripe.Checkout.Session,
  orderId: string
) {
  const stripe = getStripeClient()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { supplier: true, affiliate: true },
  })
  if (!order) throw new Error("Order not found")

  // Fallbacks si champs manquants
  const supplierPriceCents = order.supplierPriceCents ?? order.basePriceCents ?? 0
  const supplierCommissionRateBps = order.supplierCommissionRateBps ?? 1000
  const affiliateMarginCents = order.affiliateMarginCents ?? 0
  const affisellCommissionRateBps = order.affisellCommissionRateBps ?? 1200

  // Récup charge pour source_transaction
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id

  let charge: Stripe.Charge
  if (piId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(piId)
    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id
    if (!chargeId) throw new Error("No charge on payment intent")
    charge = await stripe.charges.retrieve(chargeId)
  } else if (order.stripeChargeId?.startsWith("ch_test_")) {
    charge = { id: order.stripeChargeId, amount: 0 } as Stripe.Charge
  } else if (order.stripeChargeId) {
    charge = await stripe.charges.retrieve(order.stripeChargeId)
  } else {
    throw new Error("No payment_intent on session and no stripeChargeId on order")
  }

  const orderStripeFee = charge.id.startsWith("ch_test_")
    ? 50
    : Math.round(charge.amount * 0.029 + 30) // fallback si balance_transaction pas dispo

  const split = calculateThreeWaySplit({
    supplierPriceCents,
    supplierCommissionRateBps,
    affiliateMarginCents,
    affisellCommissionRateBps,
    stripeFeeCents: orderStripeFee,
  })

  console.log("three_way_split:", {
    orderId: order.id,
    metric: "three_way_split",
    supplierPriceCents,
    supplierCommissionRateBps,
    affiliateMarginCents,
    affisellCommissionRateBps,
    ...split,
  })

  const isTest = charge.id.startsWith("ch_test_")

  const supplierDestination =
    order.supplier.stripeAccountId?.trim() ||
    process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID?.trim() ||
    null

  // Transfer Supplier
  if (split.supplierPayoutCents > 0 && supplierDestination) {
    if (!isTest) {
      const transfer = await stripe.transfers.create({
        amount: split.supplierPayoutCents,
        currency: "eur",
        destination: supplierDestination,
        source_transaction: charge.id,
        transfer_group: order.id,
        metadata: { orderId: order.id, role: "supplier" },
      })
      console.log("transfer_created:", {
        orderId: order.id,
        role: "supplier",
        transferId: transfer.id,
        amount: split.supplierPayoutCents,
      })
    } else {
      console.log("transfer_created:", {
        orderId: order.id,
        role: "supplier",
        amount: split.supplierPayoutCents,
        simulated: true,
      })
    }
  }

  // Transfer Affiliate
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() ||
    order.affiliate?.stripeAccountId?.trim() ||
    process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim() ||
    null
  if (split.affiliatePayoutCents > 0 && affiliateDestination) {
    if (!isTest) {
      const transfer = await stripe.transfers.create({
        amount: split.affiliatePayoutCents,
        currency: "eur",
        destination: affiliateDestination,
        source_transaction: charge.id,
        transfer_group: order.id,
        metadata: { orderId: order.id, role: "affiliate" },
      })
      console.log("transfer_created:", {
        orderId: order.id,
        role: "affiliate",
        transferId: transfer.id,
        amount: split.affiliatePayoutCents,
      })
    } else {
      console.log("transfer_created:", {
        orderId: order.id,
        role: "affiliate",
        amount: split.affiliatePayoutCents,
        simulated: true,
      })
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      totalCents: split.totalClientCents,
      supplierPayoutCents: split.supplierPayoutCents,
      affiliatePayoutCents: split.affiliatePayoutCents,
      affisellFeeCents: split.affisellFeeCents,
      stripeFeesCents: split.stripeFeeCents,
      status: "paid",
    },
  })
}

/** Alias webhook / scripts — même logique que `handleStripeCommissionSplit`. */
export const handleMarketplaceThreeWaySplit = handleStripeCommissionSplit

export async function findOrderIdsForCheckoutSession(sessionId: string): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeSessionId: { startsWith: `${sessionId}:line:` } }],
    },
    select: { id: true },
  })
  return orders.map((o) => o.id)
}

export async function settleMarketplaceOrdersFromCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  const stripe = getStripeClient()
  const session =
    typeof sessionOrId === "string"
      ? await stripe.checkout.sessions.retrieve(sessionOrId, { expand: ["payment_intent"] })
      : sessionOrId

  if (session.payment_status !== "paid") {
    return { processedOrderIds: [], errors: ["session_not_paid"] }
  }

  const orderIds = await findOrderIdsForCheckoutSession(session.id)
  if (orderIds.length === 0) {
    return { processedOrderIds: [], errors: ["orders_not_found"] }
  }

  const processedOrderIds: string[] = []
  const errors: string[] = []

  for (const orderId of orderIds) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { stripeTransferId: true, supplierPayoutCents: true },
    })
    if (existing?.stripeTransferId || (existing?.supplierPayoutCents ?? 0) > 0) {
      processedOrderIds.push(orderId)
      continue
    }
    try {
      await handleStripeCommissionSplit(session, orderId)
      processedOrderIds.push(orderId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "settlement_failed"
      errors.push(`${orderId}:${msg}`)
    }
  }

  return { processedOrderIds, errors }
}

async function checkoutSessionIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
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

  const sessionId = await checkoutSessionIdForPaymentIntent(paymentIntent.id)
  if (sessionId) {
    const orderIds = await findOrderIdsForCheckoutSession(sessionId)
    if (orderIds.length > 0) {
      return settleMarketplaceOrdersFromCheckoutSession(sessionId)
    }
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
