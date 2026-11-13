/**
 * Stripe payment disputes (chargebacks) — pure rules, no I/O (finalisation master doc, D7).
 *
 * A dispute is attached to a CHARGE. The buyer's bank pulls the amount from the platform balance when the dispute opens
 * (`charge.dispute.funds_withdrawn`) and gives it back if the dispute is won (`funds_reinstated`). While it is open the
 * money is not ours to pay out: the order is HELD. A lost dispute is, economically, a refund nobody asked the platform
 * for: the payouts that already left must be clawed back with the same mechanisms as a refund — never more than the
 * charge, never guessed when the amounts do not add up (then a human decides, and the hold stays).
 */

/** What a Stripe dispute status means for the orders attached to the charge. */
export type DisputeOutcome =
  /** Needs a response / under review / inquiry still open. The money is held. */
  | "open"
  /** The bank sided with the platform: funds reinstated, hold released. */
  | "won"
  /** The bank sided with the buyer: the charge is gone for good. */
  | "lost"
  /** Closed with no financial effect (an inquiry closed without a chargeback, a prevented dispute): hold released. */
  | "closed"

const OPEN_STATUSES = new Set(["needs_response", "under_review", "warning_needs_response", "warning_under_review"])
const CLOSED_WITHOUT_LOSS_STATUSES = new Set(["warning_closed", "prevented"])

/**
 * Classify a `Stripe.Dispute.status`. Fails CLOSED: an unknown or missing status counts as "open" (the money stays held
 * and a human sees it) instead of releasing or clawing back on a value this code does not know.
 */
export function disputeOutcomeFromStripeStatus(status: string | null | undefined): DisputeOutcome {
  const value = (status ?? "").trim().toLowerCase()
  if (value === "won") return "won"
  if (value === "lost") return "lost"
  if (CLOSED_WITHOUT_LOSS_STATUSES.has(value)) return "closed"
  if (OPEN_STATUSES.has(value)) return "open"
  return "open"
}

export type DisputeOrderAmount = {
  id: string
  /** What the buyer was charged for this order (`orderChargedTotalCents`). */
  chargedTotalCents: number
  currency: string | null | undefined
}

export type DisputeLossAllocation =
  | { kind: "full"; orderIds: string[]; totalCents: number }
  | {
      kind: "manual"
      reason: "no_orders" | "amount_unknown" | "currency_mismatch" | "partial_dispute" | "amount_exceeds_orders"
    }

/**
 * Decide whether a LOST dispute can be applied automatically. Only when the disputed amount equals what our orders
 * account for (1 cent of tolerance per order): then every order of the charge is fully lost. Anything else is "manual":
 *  - a partial dispute: the pending transfers would need a proportional cut that no refund path implements either;
 *  - a dispute larger than our orders (an order missing from the lookup, a corrupted total): applying it would claw back
 *    the wrong amount;
 *  - another currency: the cents are not comparable.
 * "manual" keeps the hold open and alerts: no money is moved on a guess.
 */
export function allocateDisputeLoss(args: {
  disputeAmountCents: number | null | undefined
  disputeCurrency: string | null | undefined
  orders: DisputeOrderAmount[]
}): DisputeLossAllocation {
  const { orders } = args
  if (orders.length === 0) return { kind: "manual", reason: "no_orders" }
  const amount = Math.round(Number(args.disputeAmountCents ?? 0))
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "manual", reason: "amount_unknown" }

  const currency = (args.disputeCurrency ?? "").trim().toLowerCase()
  if (currency === "" || orders.some((o) => (o.currency ?? "EUR").trim().toLowerCase() !== currency)) {
    return { kind: "manual", reason: "currency_mismatch" }
  }

  const totalCents = orders.reduce((sum, o) => sum + Math.max(0, Math.round(o.chargedTotalCents)), 0)
  if (totalCents <= 0) return { kind: "manual", reason: "amount_unknown" }

  const tolerance = orders.length
  if (amount > totalCents + tolerance) return { kind: "manual", reason: "amount_exceeds_orders" }
  if (amount < totalCents - tolerance) return { kind: "manual", reason: "partial_dispute" }
  return { kind: "full", orderIds: orders.map((o) => o.id), totalCents }
}
