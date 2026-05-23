import type Stripe from "stripe"

import { calculateSplit } from "@/lib/commission"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

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

async function orderIdsForPaymentIntent(paymentIntentId: string): Promise<string[]> {
  const stripe = getStripeClient()
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 20,
  })
  const sessionIds = sessions.data.map((s) => s.id).filter(Boolean)
  if (sessionIds.length === 0) return []

  const orders = await prisma.order.findMany({
    where: {
      OR: sessionIds.flatMap((sid) => [
        { stripeSessionId: sid },
        { stripeSessionId: { startsWith: `${sid}:line:` } },
      ]),
    },
    select: { id: true },
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

export async function processMarketplaceCommissionForPaymentIntent(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  if (paymentIntent.metadata?.flow === "blind_dropship") {
    return { processedOrderIds: [], errors: [] }
  }

  const orderIdFromMeta = paymentIntent.metadata?.orderId?.trim()
  const orderIds = orderIdFromMeta
    ? [orderIdFromMeta]
    : await orderIdsForPaymentIntent(paymentIntent.id)

  if (orderIds.length === 0) {
    return { processedOrderIds: [], errors: [] }
  }

  const stripe = getStripeClient()
  const charge = await resolveChargeForPaymentIntent(stripe, paymentIntent)
  if (!charge) {
    return { processedOrderIds: [], errors: ["missing_charge"] }
  }

  const stripeFeeCents = await stripeFeeCentsFromCharge(stripe, charge)
  const processedOrderIds: string[] = []
  const errors: string[] = []

  for (const orderId of orderIds) {
    try {
      const result = await processSingleOrderCommissionSplit({
        orderId,
        paymentIntent,
        charge,
        stripeFeeCents,
      })
      if (result.ok) processedOrderIds.push(orderId)
      else if (result.error) errors.push(`${orderId}:${result.error}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "split_failed"
      errors.push(`${orderId}:${msg}`)
    }
  }

  return { processedOrderIds, errors }
}

async function processSingleOrderCommissionSplit(args: {
  orderId: string
  paymentIntent: Stripe.PaymentIntent
  charge: Stripe.Charge
  stripeFeeCents: number
}): Promise<{ ok: boolean; error?: string }> {
  const { orderId, paymentIntent, charge } = args

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      supplier: { select: { id: true, stripeAccountId: true } },
    },
  })
  if (!order) return { ok: false, error: "order_not_found" }
  if (order.stripeTransferId) return { ok: true, error: "already_settled" }

  const subtotalCents = Math.round(
    order.subtotalCents ?? order.basePriceCents * Math.max(1, order.quantity)
  )
  const shippingCents = Math.round(order.shippingCents ?? 0)
  const taxCents = Math.round(order.taxCents ?? 0)
  const stripeFeeCents = args.stripeFeeCents

  const split = calculateSplit({
    subtotalCents,
    shippingCents,
    taxCents,
    stripeFeeCents,
  })

  console.log("[commission_calculated]", {
    orderId: order.id,
    metric: "commission_calculated",
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: split.totalCents,
    commissionCents: split.commissionCents,
    sellerPayoutCents: split.sellerPayoutCents,
    stripeFeeCents: split.stripeFeeCents,
  })

  const destination = order.supplier.stripeAccountId?.trim()
  let stripeTransferId: string | null = null
  let paymentSettlementStatus: "PAID" | "PENDING" = "PENDING"

  if (!destination) {
    console.warn("[commission_calculated] skip_transfer_no_seller_account", {
      orderId: order.id,
      supplierId: order.supplierId,
      metric: "commission_transfer_skipped",
    })
  } else if (split.sellerPayoutCents > 0) {
    const stripe = getStripeClient()
    const transfer = await stripe.transfers.create({
      amount: split.sellerPayoutCents,
      currency: (order.currency ?? paymentIntent.currency ?? "eur").toLowerCase(),
      destination,
      source_transaction: charge.id,
      metadata: {
        orderId: order.id,
        commissionCents: String(split.commissionCents),
        taxCents: String(taxCents),
      },
    })
    stripeTransferId = transfer.id
    paymentSettlementStatus = "PAID"
  } else {
    paymentSettlementStatus = "PAID"
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: charge.id,
      subtotalCents,
      totalCents: split.totalCents,
      platformCommissionRate: 0.12,
      platformCommissionCents: split.commissionCents,
      affisellFeeCents: split.commissionCents,
      stripeFeesCents: split.stripeFeeCents,
      sellerPayoutCents: split.sellerPayoutCents,
      currency: (order.currency ?? paymentIntent.currency ?? "eur").toUpperCase(),
      paymentSettlementStatus,
      stripeTransferId,
      paidAt: order.paidAt ?? new Date(),
    },
  })

  return { ok: true }
}
