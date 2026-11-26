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
