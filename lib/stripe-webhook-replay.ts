import { SPONSOR_FLOW_METADATA } from "@/lib/sponsor/sponsor-constants"

/**
 * Replay rule for Stripe webhook events (finalisation master doc, D2).
 *
 * A `ProcessedWebhook` row with status "failed" means the handler threw. The route answers HTTP 500 so Stripe retries the
 * event for days — but both routes used to answer "duplicate" (200) as soon as ANY row existed, so Stripe's retry was
 * swallowed and the failed event was never processed again. Only a "failed" row is replayable; "success" and "skipped"
 * stay duplicates. Pure (no I/O) so both routes and the processor share the exact same rule.
 *
 * Two statuses are replayable by a DELIVERY (Stripe's retry, or an operator's "Resend" in the Stripe dashboard):
 *  - `failed`: the handler threw; Stripe retries it, and the late replay cron (`replay-failed-stripe-webhooks`) selects it;
 *  - `failed_not_replayed`: the cron read the event and judged it UNSAFE to apply days late (see `replayBlockReason`) and
 *    closed it. The cron never selects it again (no repeated alert), but a human who decides to apply it can resend the
 *    event from Stripe: the route processes that resend (finalisation review: a resend used to be swallowed as "duplicate").
 * `failed_expired` (older than 30 days, or gone at Stripe) stays a duplicate: such an event can not be resent.
 */
export const REPLAYABLE_WEBHOOK_STATUS = "failed"
/** Closed by the replay cron as unsafe to apply late; processed again only when a human resends the event. */
export const NOT_REPLAYED_WEBHOOK_STATUS = "failed_not_replayed"
const DELIVERY_REPLAYABLE_STATUSES: readonly string[] = [REPLAYABLE_WEBHOOK_STATUS, NOT_REPLAYED_WEBHOOK_STATUS]

export function isReplayableWebhookRecord(existing: { status: string } | null | undefined): boolean {
  return existing != null && DELIVERY_REPLAYABLE_STATUSES.includes(existing.status)
}

/** True when a recorded event must be treated as an already-handled duplicate (anything recorded but not replayable). */
export function isDuplicateWebhookRecord(existing: { status: string } | null | undefined): boolean {
  return existing != null && !isReplayableWebhookRecord(existing)
}

/**
 * Event types the REPLAY JOB may apply days after they were emitted (finalisation review #10).
 *
 * `events.retrieve` returns the event as it was EMITTED: `data.object` is the snapshot at that moment. Replaying it three
 * to thirty days later is only safe when the handler does not write that snapshot over today's state, and does not depend
 * on the order in which events arrive:
 *  - `checkout.session.completed` — ONLY for a `mode: "payment"` marketplace session (see `replayBlockReason`): that handler
 *    reads the ORDERS (paid / past paid / closed are never reopened, payouts are keyed and idempotent), not the event's
 *    state. The same event type in `subscription` mode activates Pro / Radar / Growth from the event WITHOUT checking the
 *    live subscription status (a cancelled subscription would be revived, free, for good), and a sponsor session
 *    reactivates an EXPIRED / CANCELLED campaign with fresh dates and the featured flag: both are NOT safe late;
 *  - `payment_intent.succeeded`: order-based, like the above;
 *  - `charge.dispute.*`: handled by the dispute status against a ledger whose terminal rows are never rewritten.
 * Everything else is NOT safe late and is not replayed (the row is closed as `failed_not_replayed` and ops are told):
 *  - `customer.subscription.updated|deleted`: write plan / quota flags from the snapshot's status: a replayed old `updated`
 *    would revive a cancelled subscription and no later event would correct it;
 *  - `invoice.payment_failed`: cancels the supplier job and e-mails the buyer from an old attempt count;
 *  - `charge.refunded`: writes the settlement status from the event's `amount_refunded` snapshot, which can downgrade a
 *    REFUNDED order to PARTIALLY_REFUNDED (its payouts become releasable again);
 *  - `account.updated`, `checkout.session.expired`, anything unknown.
 * Stripe's own retries (first 3 days, in order) are unaffected: this only gates the late replay job.
 */
export const REPLAY_SAFE_EVENT_TYPES: readonly string[] = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]

export function isEventTypeSafeToReplayLate(type: string | null | undefined): boolean {
  return typeof type === "string" && REPLAY_SAFE_EVENT_TYPES.includes(type)
}

/** `checkout.session.completed` flows that are not marketplace orders (they are skipped by the order fulfilment too). */
const NON_ORDER_CHECKOUT_FLOWS: readonly string[] = [SPONSOR_FLOW_METADATA, "blind_dropship"]

/**
 * Why the replay job must NOT apply this event late, or `null` when it may. Fail closed: a `checkout.session.completed`
 * whose mode / flow can not be read is blocked. The reason is a short label for the ops alert.
 */
export function replayBlockReason(event: { type?: string | null; data?: { object?: unknown } } | null | undefined): string | null {
  const type = event?.type
  if (!isEventTypeSafeToReplayLate(type)) return `type ${type ?? "unknown"} applies a snapshot`
  if (type !== "checkout.session.completed") return null

  const session = (event?.data?.object ?? {}) as { mode?: unknown; metadata?: { flow?: unknown } | null }
  const mode = typeof session.mode === "string" ? session.mode : ""
  if (mode !== "payment") return `checkout session mode ${mode || "unknown"} (not a marketplace payment)`
  const flow = typeof session.metadata?.flow === "string" ? session.metadata.flow : ""
  if (NON_ORDER_CHECKOUT_FLOWS.includes(flow)) return `checkout session flow ${flow} (not a marketplace order)`
  return null
}

export function isEventSafeToReplayLate(event: Parameters<typeof replayBlockReason>[0]): boolean {
  return replayBlockReason(event) === null
}
