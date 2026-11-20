import type Stripe from "stripe"

import { alertRefundProblem } from "@/lib/money/refund-alert"
import {
  buildRefundIdempotencyKey,
  classifyStripeRefundError,
  resolveRefundAmountCents,
} from "@/lib/money/refund-guard"
import { orderChargedTotalCents } from "@/lib/money/split-guard"
import { evaluateRefundEligibility } from "@/lib/orders/payment-state"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function chargeIdForOrder(order: {
  stripeChargeId: string | null
  stripeSessionId: string
}): Promise<{ chargeId: string | null; lookupFailed: boolean }> {
  if (order.stripeChargeId?.trim()) return { chargeId: order.stripeChargeId.trim(), lookupFailed: false }

  const stripe = getStripeClient()
  const baseSessionId = order.stripeSessionId.split(":line:")[0] ?? order.stripeSessionId
  try {
    const session = await stripe.checkout.sessions.retrieve(baseSessionId)
    const piRef = session.payment_intent
    const piId = typeof piRef === "string" ? piRef : piRef?.id
    if (!piId) return { chargeId: null, lookupFailed: false }
    const pi = await stripe.paymentIntents.retrieve(piId)
    const latest = pi.latest_charge
    return { chargeId: typeof latest === "string" ? latest : latest?.id ?? null, lookupFailed: false }
  } catch {
    // Stripe unreachable / erroring: a replay may find the charge, unlike a session that simply has none.
    return { chargeId: null, lookupFailed: true }
  }
}

export type InitiateMarketplaceRefundResult = {
  ok: boolean
  stripeRefundId?: string
  /** Amount sent to Stripe (always explicit), set when a refund was created. */
  amountCents?: number
  error?: string
  skipped?: string
  /** On a failure: true = a later replay can succeed, false = a person has to look at it. */
  retryable?: boolean
}

/**
 * Creates a Stripe refund for a marketplace order line. The webhook (`charge.refunded`) records the commission split.
 *
 * Safety rules (finalisation master doc, D4):
 *  - state guard: nothing is refunded for an order that is already refunded (`skipped: "already_refunded"`) or that was
 *    never paid (`order_not_paid`) — `lib/orders/payment-state.ts`;
 *  - the amount is ALWAYS explicit and > 0, capped by what the order was charged minus the refunds already recorded in
 *    `OrderStripeRefund`; an invalid amount (0, negative, NaN) is REFUSED, never turned into a full refund, and no
 *    Stripe call is made;
 *  - a stable Stripe idempotency key per (order, amount, reason, operation): a retry returns the same refund.
 *
 * Every refusal or failure is reported (`alertRefundProblem`) except `already_refunded`, which is a normal replay.
 * `options.amountCents` omitted = refund what is left.
 */
export async function initiateMarketplaceOrderRefund(
  orderId: string,
  options?: {
    reason?: Stripe.RefundCreateParams.Reason
    metadata?: Record<string, string>
    amountCents?: number
    /** Names the business operation for the idempotency key (default: `source`, plus `returnId` when given). */
    idempotencyScope?: string
  }
): Promise<InitiateMarketplaceRefundResult> {
  const source = options?.metadata?.source ?? "marketplace_refund"
  const reason = options?.reason ?? "requested_by_customer"

  const refuse = (error: string, retryable = false): InitiateMarketplaceRefundResult => {
    console.log("[stripe-refund]", { orderId, source, result: "refused", reason: error })
    alertRefundProblem({ source, subjectId: orderId, error, retryable })
    return { ok: false, error, retryable }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      stripeChargeId: true,
      stripeSessionId: true,
      totalCents: true,
      subtotalCents: true,
      taxCents: true,
      sellingPriceCents: true,
      paymentSettlementStatus: true,
      stripeRefunds: { select: { amountCents: true } },
    },
  })
  if (!order) return refuse("order_not_found")

  const eligibility = evaluateRefundEligibility(order)
  if (!eligibility.ok) {
    if (eligibility.reason === "already_refunded") return { ok: false, skipped: "already_refunded" }
    return refuse(eligibility.reason)
  }

  const alreadyRefundedCents = (order.stripeRefunds ?? []).reduce((sum, r) => sum + (r.amountCents ?? 0), 0)
  const decision = resolveRefundAmountCents({
    chargedTotalCents: orderChargedTotalCents(order),
    alreadyRefundedCents,
    requestedCents: options?.amountCents,
  })
  if (!decision.ok) {
    if (decision.reason === "already_refunded") return { ok: false, skipped: "already_refunded" }
    return refuse(decision.reason)
  }
  const amountCents = decision.amountCents

  const { chargeId, lookupFailed } = await chargeIdForOrder(order)
  if (!chargeId) return refuse("no_stripe_charge", lookupFailed)

  const scope =
    options?.idempotencyScope ??
    [source, options?.metadata?.returnId].filter((part): part is string => Boolean(part)).join(":")
  const idempotencyKey = buildRefundIdempotencyKey({ orderId, amountCents, reason, scope })

  try {
    const stripe = getStripeClient()
    const refund = await stripe.refunds.create(
      {
        charge: chargeId,
        amount: amountCents,
        reason,
        // `orderId` last: the webhook attributes a multi-line charge's refund to an order from this key only.
        metadata: { source, ...options?.metadata, orderId },
      },
      { idempotencyKey }
    )
    console.log("[stripe-refund]", {
      orderId,
      stripeRefundId: refund.id,
      amountCents,
      alreadyRefundedCents,
      source,
      result: "created",
    })
    return { ok: true, stripeRefundId: refund.id, amountCents }
  } catch (e) {
    const { message, retryable } = classifyStripeRefundError(e)
    console.log("[stripe-refund]", { orderId, source, result: "error", reason: message, retryable })
    alertRefundProblem({
      source,
      subjectId: orderId,
      error: message,
      retryable,
      extra: { amountCents },
    })
    return { ok: false, error: message, retryable }
  }
}
