import "server-only"

import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { isUnallocatedLineRefund } from "@/lib/unallocated-line"
import {
  decideReleaseWithStripe,
  type LocalRefundRow,
  type ReleaseCheck,
  type StripeRefundLite,
} from "@/lib/transfers/stripe-release-check"

/** At most this many refunds are read for one charge: more means something is wrong — hold, never guess. */
const MAX_REFUNDS_READ = 100

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null))

/**
 * Ask Stripe, right before a transfer, what really happened to the order's charge, and compare it with our rows
 * (`decideReleaseWithStripe`). Read-only at Stripe (`charges.retrieve`, `checkout.sessions.retrieve`,
 * `paymentIntents.retrieve`, `refunds.list`).
 * Never throws: any Stripe error is `stripe_unavailable` and the caller HOLDS the transfer.
 */
export async function verifyReleaseWithStripe(
  stripe: Pick<Stripe, "charges" | "checkout" | "paymentIntents" | "refunds" | "disputes">,
  order: {
    id: string
    currency: string | null
    stripeChargeId: string | null
    stripePaymentIntentId: string | null
    stripeSessionId: string | null
  },
  localRefunds: readonly LocalRefundRow[],
): Promise<ReleaseCheck> {
  let charge: Stripe.Charge
  try {
    let chargeId = order.stripeChargeId?.trim() || null
    let paymentIntentId = order.stripePaymentIntentId?.trim() || null
    // A cart records the charge id on ONE of its orders only (the column is unique): the other lines carry neither id.
    // Their payment is the one of the base Checkout Session — same resolution as a refund of such a line.
    const baseSessionId = order.stripeSessionId?.split(":line:")[0]?.trim()
    if (!chargeId && !paymentIntentId && baseSessionId) {
      const session = await stripe.checkout.sessions.retrieve(baseSessionId)
      paymentIntentId = idOf(session.payment_intent)
    }
    if (!chargeId && paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      chargeId = idOf(pi.latest_charge as string | { id: string } | null)
    }
    if (!chargeId) return { ok: false, reason: "charge_not_found", detail: "no charge / payment intent on the order" }
    charge = await stripe.charges.retrieve(chargeId)
  } catch (err) {
    return { ok: false, reason: "stripe_unavailable", detail: err instanceof Error ? err.message : String(err) }
  }

  const stripeRefunds: StripeRefundLite[] = []
  // Refunds of a paid line that produced NO order: they are nobody's order refund (no `OrderStripeRefund` row is ever
  // written for them), so they must not hold the payouts of the other lines of the same payment.
  let read = 0
  try {
    // refunds.list({ charge }) — `Charge.refunds` is not returned by default on this API version, so it is never relied on.
    for await (const r of stripe.refunds.list({ charge: charge.id, limit: 100 })) {
      read += 1
      if (read > MAX_REFUNDS_READ) {
        return {
          ok: false,
          reason: "stripe_unavailable",
          detail: `more than ${MAX_REFUNDS_READ} refunds on ${charge.id}`,
        }
      }
      if (isUnallocatedLineRefund(r)) continue
      stripeRefunds.push({
        id: r.id,
        amount: r.amount,
        status: r.status,
        metadataOrderId: (r.metadata?.orderId as string | undefined) ?? null,
      })
    }
  } catch (err) {
    return { ok: false, reason: "stripe_unavailable", detail: err instanceof Error ? err.message : String(err) }
  }

  // Disputes: read only when Stripe flags the charge, then decided by each dispute's live status (all pages).
  const stripeDisputes: Array<{ id: string; status: string | null }> = []
  if (charge.disputed) {
    try {
      for await (const d of stripe.disputes.list({ charge: charge.id, limit: 100 })) {
        stripeDisputes.push({ id: d.id, status: d.status })
        if (stripeDisputes.length > MAX_REFUNDS_READ) {
          return {
            ok: false,
            reason: "stripe_unavailable",
            detail: `more than ${MAX_REFUNDS_READ} disputes on ${charge.id}`,
          }
        }
      }
    } catch (err) {
      return { ok: false, reason: "stripe_unavailable", detail: err instanceof Error ? err.message : String(err) }
    }
  }

  // A refund of such a line made by hand in the Stripe dashboard carries no marker: the webhook recorded its proof.
  // Read only when a refund is not in our rows, and an unreadable trace holds the transfer.
  let refundsToCompare = stripeRefunds
  const ours = new Set(localRefunds.map((r) => r.stripeRefundId))
  const piOfCharge = idOf(charge.payment_intent as string | { id: string } | null | undefined)
  if (piOfCharge && stripeRefunds.some((r) => !ours.has(r.id))) {
    try {
      const { loadTracedUnallocatedLinesForPaymentIntent } = await import("@/lib/unallocated-line.server")
      const traced = await loadTracedUnallocatedLinesForPaymentIntent(piOfCharge)
      const lineRefundIds = new Set(traced.map((t) => t.refundedByRefundId).filter(Boolean))
      refundsToCompare = stripeRefunds.filter((r) => !lineRefundIds.has(r.id))
    } catch (err) {
      return { ok: false, reason: "stripe_unavailable", detail: `unallocated-line trace unreadable: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // How many orders this charge pays for (a multi-line checkout shares one charge across `${session}:line:N` orders).
  let chargeOrderCount = 1
  const sessionBase = order.stripeSessionId?.split(":line:")[0]?.trim()
  if (sessionBase) {
    try {
      chargeOrderCount = Math.max(
        1,
        await prisma.order.count({
          where: { OR: [{ stripeSessionId: sessionBase }, { stripeSessionId: { startsWith: `${sessionBase}:line:` } }] },
        }),
      )
    } catch (err) {
      // "Never throws": an unreadable database holds the transfer, it does not consume an attempt.
      return { ok: false, reason: "stripe_unavailable", detail: `order count unreadable: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  return decideReleaseWithStripe({
    orderId: order.id,
    orderCurrency: order.currency,
    chargeOrderCount,
    charge: {
      id: charge.id,
      status: charge.status,
      captured: charge.captured,
      disputed: charge.disputed,
      currency: charge.currency,
    },
    stripeDisputes,
    stripeRefunds: refundsToCompare,
    localRefunds,
  })
}
