import { captureException } from "@sentry/nextjs"

import { opsWebhookAlert } from "@/lib/ops-webhook"

export type RefundProblem = {
  /** Where the refund was requested from (`ship_sla_auto_cancel`, `supplier_mark_refunded`, `ghost_oos`, …). */
  source: string
  /** Order id, or the Checkout Session id for a refund that has no order yet (ghost). */
  subjectId: string
  error: string
  /** true = a later replay can succeed by itself; false = a person has to look at it. */
  retryable: boolean
  extra?: Record<string, unknown>
}

/**
 * A refund that was REQUESTED but did not happen. Never throws (the caller is already handling a failure): server log,
 * Sentry and the ops webhook (Slack / Discord), so the money owed to a buyer cannot fail silently.
 */
export function alertRefundProblem(problem: RefundProblem): void {
  const line = `[Refund] ${problem.source} ${problem.subjectId} NOT refunded: ${problem.error} — ${
    problem.retryable ? "will be retried" : "MANUAL ACTION REQUIRED"
  }`
  try {
    console.error("[refund-failure]", {
      source: problem.source,
      subjectId: problem.subjectId,
      error: problem.error,
      retryable: problem.retryable,
      ...problem.extra,
    })
  } catch {
    /* logging must never break a money path */
  }
  try {
    captureException(new Error(line), {
      tags: { module: "refund", source: problem.source, retryable: String(problem.retryable) },
      extra: { subjectId: problem.subjectId, ...problem.extra },
    })
  } catch {
    /* Sentry unavailable */
  }
  try {
    void Promise.resolve(opsWebhookAlert(line)).catch(() => {})
  } catch {
    /* ops webhook unavailable */
  }
}
