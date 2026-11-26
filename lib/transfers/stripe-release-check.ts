import { attributeRefundToOrder } from "@/lib/money/split-guard"
import { disputeOutcomeFromStripeStatus } from "@/lib/orders/dispute-state"

/**
 * Last check with STRIPE ITSELF before a transfer leaves — pure decision. Server side: `stripe-release-check.server.ts`.
 *
 * Until now the payout trusted our own tables only: a refund whose webhook never arrived (lost, failed beyond Stripe's
 * retries, an endpoint misconfigured) left no `OrderStripeRefund` row, so the release paid the full share out of money the
 * buyer had already got back. Stripe is the source of truth for what went back to the buyer; our tables are the source of
 * truth for how it is split. This check refuses to pay unless BOTH agree, and never computes an amount itself: when they
 * agree, the amount owed is the one `payableAfterRefunds` (#26) derives from our rows, i.e. the single rule.
 *
 * Refund statuses (Stripe API 2026-04-22, `Refund.status`): `succeeded`, `pending` and `requires_action` are money that is
 * (or may be) going back to the buyer — counted as refunded, the cautious side; `failed` and `canceled` are not refunds.
 * An unknown / null status is counted as a refund too (fail closed).
 *
 * Everything that does not add up HOLDS the transfer (it stays PENDING, attempts are not consumed) and says why:
 * - the charge is not a captured, succeeded charge in the order's currency;
 * - a dispute on the charge is open (or of unknown status) or lost according to Stripe's LIVE disputes (even if our
 *   dispute webhook never arrived); a won / closed-without-loss dispute does not block;
 * - a refund on a multi-order charge names no order (the refund webhook refuses to guess as well);
 * - a refund Stripe knows about is missing from our rows, or has another amount;
 * - a row we recorded is not an outstanding refund at Stripe (failed / canceled / unknown id).
 * Rows that are not Stripe refunds (a lost dispute recorded by D7, id `dp_…:order`) are ours alone and not compared.
 */

export const OUTSTANDING_REFUND_STATUSES = new Set(["succeeded", "pending", "requires_action"])
const NOT_A_REFUND_STATUSES = new Set(["failed", "canceled"])

export type StripeChargeLite = {
  id: string
  status: string | null
  captured: boolean | null
  disputed: boolean | null
  currency: string | null
}

export type StripeRefundLite = { id: string; amount: number; status: string | null; metadataOrderId: string | null }

export type LocalRefundRow = { stripeRefundId: string; amountCents: number }

export type ReleaseCheckReason =
  | "charge_not_found"
  | "stripe_unavailable"
  | "charge_not_succeeded"
  | "charge_disputed"
  | "dispute_lost_not_applied"
  | "currency_mismatch"
  | "ambiguous_refund"
  | "refund_not_recorded"
  | "refund_amount_mismatch"
  | "recorded_refund_not_at_stripe"

export type ReleaseCheck =
  | { ok: true; chargeId: string; stripeRefundCents: number; stripeRefundCount: number }
  | { ok: false; reason: ReleaseCheckReason; detail: string }

/** A row recorded by D7 for a lost dispute (`${disputeId}:${orderId}`), not a Stripe refund. */
export function isSyntheticRefundRow(stripeRefundId: string): boolean {
  return stripeRefundId.includes(":")
}

const isOutstanding = (status: string | null) => {
  const s = (status ?? "").trim().toLowerCase()
  return !NOT_A_REFUND_STATUSES.has(s) // succeeded / pending / requires_action / unknown → counted
}

export function decideReleaseWithStripe(args: {
  orderId: string
  orderCurrency: string | null
  /** How many orders this charge pays for (1 = a single-order checkout). */
  chargeOrderCount: number
  charge: StripeChargeLite
  /** Every dispute Stripe lists for the charge (read when `charge.disputed`; empty otherwise). */
  stripeDisputes?: ReadonlyArray<{ id: string; status: string | null }>
  stripeRefunds: readonly StripeRefundLite[]
  localRefunds: readonly LocalRefundRow[]
}): ReleaseCheck {
  const { charge } = args
  if ((charge.status ?? "").toLowerCase() !== "succeeded" || charge.captured === false) {
    return { ok: false, reason: "charge_not_succeeded", detail: `charge ${charge.id} status=${charge.status}` }
  }
  // `Charge.disputed` says the charge HAS BEEN disputed — it does not say the dispute is still open (a won dispute leaves
  // it set). The disputes themselves decide, by their live status: open / unknown → held; lost → held (D7 closes a lost
  // order, so a lost dispute reaching this point was not applied); only won / closed-without-loss let the money go.
  const disputes = args.stripeDisputes ?? []
  if (charge.disputed === true && disputes.length === 0) {
    return {
      ok: false,
      reason: "charge_disputed",
      detail: `charge ${charge.id} is disputed but Stripe listed no dispute`,
    }
  }
  for (const d of disputes) {
    const outcome = disputeOutcomeFromStripeStatus(d.status)
    if (outcome === "open") {
      return { ok: false, reason: "charge_disputed", detail: `dispute ${d.id} is ${d.status ?? "unknown"} at Stripe` }
    }
    if (outcome === "lost") {
      return { ok: false, reason: "dispute_lost_not_applied", detail: `dispute ${d.id} is lost at Stripe` }
    }
  }
  const orderCurrency = (args.orderCurrency ?? "EUR").trim().toLowerCase()
  if ((charge.currency ?? "").trim().toLowerCase() !== orderCurrency) {
    return { ok: false, reason: "currency_mismatch", detail: `charge ${charge.currency} vs order ${orderCurrency}` }
  }

  // Stripe's refunds that concern THIS order and are (or may be) money back to the buyer.
  const mine: StripeRefundLite[] = []
  for (const r of args.stripeRefunds) {
    if (!isOutstanding(r.status)) continue
    const attribution = attributeRefundToOrder({
      chargeOrderCount: args.chargeOrderCount,
      orderId: args.orderId,
      refundMetadataOrderId: r.metadataOrderId,
    })
    if (attribution === "ambiguous") {
      return { ok: false, reason: "ambiguous_refund", detail: `refund ${r.id} names no order on a multi-order charge` }
    }
    if (attribution === "apply") mine.push(r)
  }

  const local = new Map(
    args.localRefunds
      .filter((r) => !isSyntheticRefundRow(r.stripeRefundId))
      .map((r) => [r.stripeRefundId, r.amountCents]),
  )
  for (const r of mine) {
    const recorded = local.get(r.id)
    if (recorded == null) {
      return {
        ok: false,
        reason: "refund_not_recorded",
        detail: `refund ${r.id} (${r.amount}) is at Stripe, not in our rows`,
      }
    }
    if (recorded !== r.amount) {
      return {
        ok: false,
        reason: "refund_amount_mismatch",
        detail: `refund ${r.id}: Stripe ${r.amount}, ours ${recorded}`,
      }
    }
  }
  const atStripe = new Set(mine.map((r) => r.id))
  for (const id of local.keys()) {
    if (!atStripe.has(id)) {
      return {
        ok: false,
        reason: "recorded_refund_not_at_stripe",
        detail: `refund ${id} is ours, not outstanding at Stripe`,
      }
    }
  }

  return {
    ok: true,
    chargeId: charge.id,
    stripeRefundCents: mine.reduce((n, r) => n + r.amount, 0),
    stripeRefundCount: mine.length,
  }
}
