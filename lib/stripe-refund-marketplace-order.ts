import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function chargeIdForOrder(order: {
  stripeChargeId: string | null
  stripeSessionId: string
}): Promise<string | null> {
  if (order.stripeChargeId?.trim()) return order.stripeChargeId.trim()

  const stripe = getStripeClient()
  const baseSessionId = order.stripeSessionId.split(":line:")[0] ?? order.stripeSessionId
  try {
    const session = await stripe.checkout.sessions.retrieve(baseSessionId)
    const piRef = session.payment_intent
    const piId = typeof piRef === "string" ? piRef : piRef?.id
    if (!piId) return null
    const pi = await stripe.paymentIntents.retrieve(piId)
    const latest = pi.latest_charge
    return typeof latest === "string" ? latest : latest?.id ?? null
  } catch {
    return null
  }
}

export type InitiateMarketplaceRefundResult = {
  ok: boolean
  stripeRefundId?: string
  error?: string
  skipped?: string
}

/**
 * Creates a full Stripe refund for a marketplace order line. Webhook records commission split.
 */
export async function initiateMarketplaceOrderRefund(
  orderId: string,
  options?: {
    reason?: Stripe.RefundCreateParams.Reason
    metadata?: Record<string, string>
    amountCents?: number
  }
): Promise<InitiateMarketplaceRefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      stripeChargeId: true,
      stripeSessionId: true,
      totalCents: true,
      sellingPriceCents: true,
      paymentSettlementStatus: true,
    },
  })
  if (!order) return { ok: false, error: "order_not_found" }
  if (
    order.paymentSettlementStatus === "REFUNDED" ||
    order.paymentSettlementStatus === "REFUND_PENDING_CLAWBACK"
  ) {
    return { ok: false, skipped: "already_refunded" }
  }

  const chargeId = await chargeIdForOrder(order)
  if (!chargeId) return { ok: false, error: "no_stripe_charge" }

  const stripe = getStripeClient()
  const orderTotalCents = order.totalCents ?? order.sellingPriceCents
  const requestedCents =
    options?.amountCents != null && options.amountCents > 0
      ? Math.min(Math.round(options.amountCents), orderTotalCents)
      : orderTotalCents

  try {
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: requestedCents > 0 ? requestedCents : undefined,
      reason: options?.reason ?? "requested_by_customer",
      metadata: {
        orderId,
        source: options?.metadata?.source ?? "marketplace_refund",
        ...options?.metadata,
      },
    })
    console.log("[stripe-refund]", {
      orderId,
      stripeRefundId: refund.id,
      amountCents: requestedCents,
      source: options?.metadata?.source ?? "marketplace_refund",
      result: "created",
    })
    return { ok: true, stripeRefundId: refund.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("[stripe-refund]", { orderId, result: "error", reason: msg })
    return { ok: false, error: msg }
  }
}
