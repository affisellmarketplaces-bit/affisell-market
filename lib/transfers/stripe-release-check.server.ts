import "server-only"

import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
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
 * (`decideReleaseWithStripe`). Read-only at Stripe (`charges.retrieve`, `paymentIntents.retrieve`, `refunds.list`).
 * Never throws: any Stripe error is `stripe_unavailable` and the caller HOLDS the transfer.
 */
export async function verifyReleaseWithStripe(
  stripe: Pick<Stripe, "charges" | "paymentIntents" | "refunds">,
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
    if (!chargeId && order.stripePaymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
      chargeId = idOf(pi.latest_charge as string | { id: string } | null)
    }
    if (!chargeId) return { ok: false, reason: "charge_not_found", detail: "no charge / payment intent on the order" }
    charge = await stripe.charges.retrieve(chargeId)
  } catch (err) {
    return { ok: false, reason: "stripe_unavailable", detail: err instanceof Error ? err.message : String(err) }
  }

  const stripeRefunds: StripeRefundLite[] = []
  try {
    // refunds.list({ charge }) — `Charge.refunds` is not returned by default on this API version, so it is never relied on.
    for await (const r of stripe.refunds.list({ charge: charge.id, limit: 100 })) {
      stripeRefunds.push({
        id: r.id,
        amount: r.amount,
        status: r.status,
        metadataOrderId: (r.metadata?.orderId as string | undefined) ?? null,
      })
      if (stripeRefunds.length > MAX_REFUNDS_READ) {
        return {
          ok: false,
          reason: "stripe_unavailable",
          detail: `more than ${MAX_REFUNDS_READ} refunds on ${charge.id}`,
        }
      }
    }
  } catch (err) {
    return { ok: false, reason: "stripe_unavailable", detail: err instanceof Error ? err.message : String(err) }
  }

  // How many orders this charge pays for (a multi-line checkout shares one charge across `${session}:line:N` orders).
  let chargeOrderCount = 1
  const sessionBase = order.stripeSessionId?.split(":line:")[0]?.trim()
  if (sessionBase) {
    chargeOrderCount = Math.max(
      1,
      await prisma.order.count({
        where: { OR: [{ stripeSessionId: sessionBase }, { stripeSessionId: { startsWith: `${sessionBase}:line:` } }] },
      }),
    )
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
    stripeRefunds,
    localRefunds,
  })
}
