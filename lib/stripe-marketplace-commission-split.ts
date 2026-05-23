import type Stripe from "stripe"

import { calculateSplit } from "@/lib/commission"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

function commissionRateBpsFromEnv(): number {
  const raw = process.env.AFFISELL_COMMISSION_BPS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 1200
  return Number.isFinite(n) && n >= 0 ? n : 1200
}

function resolveConnectDestination(
  supplierStripeAccountId: string | null | undefined,
  sellerIdFromMeta: string | null | undefined,
  orderSupplierId: string
): string | null {
  const fromSupplier = supplierStripeAccountId?.trim()
  if (fromSupplier) return fromSupplier

  const fromEnv = process.env.TEST_STRIPE_CONNECT_ACCOUNT_ID?.trim()
  if (fromEnv) {
    console.log("webhook: using TEST_STRIPE_CONNECT_ACCOUNT_ID fallback", {
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
  const commissionRateBps = commissionRateBpsFromEnv()

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
    const subtotalCents = allocated?.subtotalCents ?? session.amount_subtotal ?? 0
    const taxCents = allocated?.taxCents ?? session.total_details?.amount_tax ?? 0
    const shippingCents = order.shippingCents ?? 0

    const orderStripeFee = allocated?.stripeFeeCents ?? stripeFeeCents

    const split = calculateSplit({
      subtotalCents,
      shippingCents,
      taxCents,
      stripeFeeCents: orderStripeFee,
      commissionRateBps,
    })

    console.log("split:", {
      orderId: order.id,
      metric: "commission_calculated",
      subtotalCents,
      shippingCents,
      taxCents,
      commissionRateBps,
      platformCommissionCents: split.commissionCents,
      sellerPayoutCents: split.sellerPayoutCents,
      stripeFeeCents: orderStripeFee,
      totalCents: split.totalCents,
    })

    const destination = resolveConnectDestination(
      order.supplier.stripeAccountId,
      sellerIdMeta,
      order.supplierId
    )

    if (!destination) {
      console.warn("webhook: skip_transfer_no_seller_account", {
        orderId: order.id,
        supplierId: order.supplierId,
        supplierEmail: order.supplier.email,
      })
      errors.push(`${order.id}:missing_stripe_account`)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: charge.id,
          subtotalCents,
          taxCents,
          totalCents: split.totalCents,
          platformCommissionCents: split.commissionCents,
          affisellFeeCents: split.commissionCents,
          stripeFeesCents: split.stripeFeeCents,
          sellerPayoutCents: split.sellerPayoutCents,
          platformCommissionRate: commissionRateBps / 10_000,
        },
      })
      continue
    }

    let stripeTransferId: string | null = null
    try {
      if (split.sellerPayoutCents > 0) {
        const transfer = await stripe.transfers.create({
          amount: split.sellerPayoutCents,
          currency: (order.currency ?? paymentIntent.currency ?? "eur").toLowerCase(),
          destination,
          source_transaction: charge.id,
          metadata: {
            orderId: order.id,
            sessionId: session.id,
            commissionCents: String(split.commissionCents),
            taxCents: String(taxCents),
          },
        })
        stripeTransferId = transfer.id
        console.log("transfer_created:", {
          orderId: order.id,
          transferId: transfer.id,
          amount: split.sellerPayoutCents,
          destination,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "transfer_failed"
      console.error("webhook: transfer_failed", { orderId: order.id, error: msg })
      errors.push(`${order.id}:${msg}`)
      continue
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: charge.id,
        subtotalCents,
        taxCents,
        totalCents: split.totalCents,
        platformCommissionRate: commissionRateBps / 10_000,
        platformCommissionCents: split.commissionCents,
        affisellFeeCents: split.commissionCents,
        stripeFeesCents: split.stripeFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
        currency: (order.currency ?? paymentIntent.currency ?? "eur").toUpperCase(),
        paymentSettlementStatus: stripeTransferId ? "SETTLED" : "PAID",
        stripeTransferId,
        paidAt: order.paidAt ?? new Date(),
      },
    })

    if (!order.supplier.stripeAccountId?.trim() && destination) {
      await prisma.user.updateMany({
        where: { id: order.supplierId, stripeAccountId: null },
        data: { stripeAccountId: destination },
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
