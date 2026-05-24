import type Stripe from "stripe"

import { prisma } from "./prisma"
import { getStripeClient } from "./stripe"

export async function handleMarketplaceThreeWaySplit(
  session: Stripe.Checkout.Session,
  orderId: string
) {
  console.log("SPLIT START", { orderId })

  const stripe = getStripeClient()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { supplier: true, affiliate: true },
  })
  if (!order) throw new Error("Order not found")

  const totalCents = session.amount_total
  if (totalCents == null) throw new Error("Session amount_total missing")

  const supplierDestination = order.supplier.stripeAccountId?.trim()
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim()

  if (!supplierDestination) {
    throw new Error("Supplier stripeAccountId missing")
  }
  if (!affiliateDestination) {
    throw new Error("Affiliate stripeAccountId missing")
  }

  const supplierPayoutCents = Math.floor(totalCents * 0.6)
  const affiliatePayoutCents = Math.floor(totalCents * 0.2667)
  const affisellFeeCents = totalCents - supplierPayoutCents - affiliatePayoutCents
  const stripeFeeCents = Math.round(totalCents * 0.029 + 25)
  const affisellNetCents = affisellFeeCents - stripeFeeCents

  console.log("three_way_split", {
    orderId,
    metric: "three_way_split",
    supplierPayoutCents,
    affiliatePayoutCents,
    affisellFeeCents,
    affisellNetCents,
    transferGroup: orderId,
  })

  await stripe.transfers.create({
    amount: supplierPayoutCents,
    currency: "eur",
    destination: supplierDestination,
    transfer_group: orderId,
    metadata: { orderId, role: "supplier" },
  })
  console.log("transfer_created", {
    orderId,
    role: "supplier",
    amount: supplierPayoutCents,
    destination: supplierDestination,
  })

  await stripe.transfers.create({
    amount: affiliatePayoutCents,
    currency: "eur",
    destination: affiliateDestination,
    transfer_group: orderId,
    metadata: { orderId, role: "affiliate" },
  })
  console.log("transfer_created", {
    orderId,
    role: "affiliate",
    amount: affiliatePayoutCents,
    destination: affiliateDestination,
  })

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      supplierPayoutCents,
      affiliatePayoutCents,
      affisellFeeCents,
      stripeFeesCents: stripeFeeCents,
      totalCents,
      stripeSessionId: session.id,
    },
  })
}

/** @deprecated Utiliser `handleMarketplaceThreeWaySplit` — conservé pour scripts existants. */
export const handleStripeCommissionSplit = handleMarketplaceThreeWaySplit

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
      await handleMarketplaceThreeWaySplit(session, orderId)
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
