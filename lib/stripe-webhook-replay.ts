/**
 * Replay rule for Stripe webhook events (finalisation master doc, D2).
 *
 * A `ProcessedWebhook` row with status "failed" means the handler threw. The route answers HTTP 500 so Stripe retries the
 * event for days — but both routes used to answer "duplicate" (200) as soon as ANY row existed, so Stripe's retry was
 * swallowed and the failed event was never processed again. Only a "failed" row is replayable; "success" and "skipped"
 * stay duplicates. Pure (no I/O) so both routes and the processor share the exact same rule.
 */
export const REPLAYABLE_WEBHOOK_STATUS = "failed"

export function isReplayableWebhookRecord(existing: { status: string } | null | undefined): boolean {
  return existing != null && existing.status === REPLAYABLE_WEBHOOK_STATUS
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
 *  - `checkout.session.completed`, `payment_intent.succeeded`: the handler reads the ORDERS (paid / past paid / closed are
 *    never reopened, payouts are keyed and idempotent), not the event's state.
 *  - `charge.dispute.*`: handled by the dispute status against a ledger whose terminal rows are never rewritten.
 * Everything else is NOT safe late and is not replayed (the row is closed as `failed_expired` and ops are told):
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
