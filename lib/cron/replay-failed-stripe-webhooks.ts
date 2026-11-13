import * as Sentry from "@sentry/nextjs"
import type Stripe from "stripe"

import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"
import { REPLAYABLE_WEBHOOK_STATUS } from "@/lib/stripe-webhook-replay"

/**
 * Replay of Stripe webhook events whose processing FAILED and that Stripe will no longer retry (finalisation master doc, D2).
 *
 * `processStripeWebhookEvent` records a handler failure as `ProcessedWebhook.status = "failed"` and the route answers 500, so
 * Stripe retries — for up to 3 days in live mode (exponential back-off). After that nobody retried the event: a paid
 * checkout, a refund or a dispute stayed half-processed forever. This job takes the `failed` rows older than that window,
 * re-reads the event at Stripe (`events.retrieve`, which only keeps events for 30 days) and runs it through the SAME
 * processor, which is idempotent (it claims the failed row, handlers are keyed). Bounds per run: a count cap and a time
 * budget (the route has a 60 s function budget); the oldest rows go first because they are the closest to Stripe's cut-off.
 *
 *  - Still failing after the replay: one aggregated ops alert per run, and the route answers 500 (a red cron run) — the
 *    job is scheduled every 6 hours, so an unresolved money event is told 4 times a day, never silently.
 *  - Older than 30 days, or gone at Stripe (`resource_missing`): the event can never be replayed. The row becomes
 *    `failed_expired` (it keeps its error text as evidence, and stops being selected) and ops are told once, with the ids,
 *    to reconcile by hand.
 * Only ids that look like Stripe events (`evt_…`) are read: `ProcessedWebhook` is also the ledger of other idempotent jobs.
 */

/** Stripe retries a live-mode webhook for up to 3 days. */
export const STRIPE_RETRY_WINDOW_HOURS = 72
/** Stripe keeps events (and `events.retrieve` answers) for 30 days. */
export const STRIPE_EVENT_RETENTION_DAYS = 30
export const REPLAY_MAX_EVENTS_PER_RUN = 20
/** No new event is started after this long (the route's function budget is 60 s). */
export const REPLAY_TIME_BUDGET_MS = 40_000
export const EXPIRED_WEBHOOK_STATUS = "failed_expired"
const EXPIRED_BATCH = 50
const ALERT_LIST_MAX = 10

export type ReplayFailure = { eventId: string; type: string | null; error: string }

export type ReplayFailedWebhooksResult = {
  /** `failed` rows old enough and young enough to be replayed, taken this run (cap applied). */
  scanned: number
  /** Replayed and now success / skipped. */
  replayed: number
  /** Another delivery (Stripe's own retry) processed it between the read and the claim. */
  alreadyHandled: number
  /** Still failing after the replay, or Stripe could not be read: the next run tries again. */
  stillFailing: number
  /** Rows older than 30 days, or events gone at Stripe: marked `failed_expired`, can not be replayed. */
  expired: number
  /** Rows left for the next run because the cap or the time budget was reached. */
  deferred: number
  failures: ReplayFailure[]
  expiredIds: string[]
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300)
}

/** `events.retrieve` answers 404 / resource_missing for an event Stripe no longer has. */
function isEventGone(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { code, statusCode } = error as { code?: unknown; statusCode?: unknown }
  return code === "resource_missing" || statusCode === 404
}

async function alertOps(text: string, extra: Record<string, unknown>): Promise<void> {
  logStripeWebhookError({ metric: "stripe_webhook_replay_alert", text, ...extra })
  if (process.env.SENTRY_DSN?.trim()) {
    try {
      Sentry.captureMessage(text.slice(0, 200), { level: "error", extra })
    } catch {
      // alerting must never break the job
    }
  }
  try {
    await opsWebhookAlert(text)
  } catch {
    // alerting must never break the job
  }
}

export async function replayFailedStripeWebhooks(options?: {
  now?: Date
  limit?: number
  timeBudgetMs?: number
}): Promise<ReplayFailedWebhooksResult> {
  const startedAt = Date.now()
  const now = options?.now ?? new Date()
  const limit = Math.max(1, Math.min(options?.limit ?? REPLAY_MAX_EVENTS_PER_RUN, 100))
  const timeBudgetMs = options?.timeBudgetMs ?? REPLAY_TIME_BUDGET_MS

  const retryWindowEnd = new Date(now.getTime() - STRIPE_RETRY_WINDOW_HOURS * 3_600_000)
  const retentionStart = new Date(now.getTime() - STRIPE_EVENT_RETENTION_DAYS * 86_400_000)
  const stripeEventIds = { startsWith: "evt_" }

  const result: ReplayFailedWebhooksResult = {
    scanned: 0,
    replayed: 0,
    alreadyHandled: 0,
    stillFailing: 0,
    expired: 0,
    deferred: 0,
    failures: [],
    expiredIds: [],
  }

  // 1. Too old to ever be replayed: close them (evidence kept) and tell ops once.
  const tooOld = await prisma.processedWebhook.findMany({
    where: { status: REPLAYABLE_WEBHOOK_STATUS, id: stripeEventIds, createdAt: { lt: retentionStart } },
    orderBy: { createdAt: "asc" },
    take: EXPIRED_BATCH,
    select: { id: true },
  })
  if (tooOld.length > 0) {
    const ids = tooOld.map((row) => row.id)
    const closed = await prisma.processedWebhook.updateMany({
      where: { id: { in: ids }, status: REPLAYABLE_WEBHOOK_STATUS },
      data: { status: EXPIRED_WEBHOOK_STATUS },
    })
    result.expired += closed.count
    result.expiredIds.push(...ids)
  }

  // 2. Replayable: Stripe gave up (older than its retry window) and still has the event (younger than 30 days).
  const replayableWhere = {
    status: REPLAYABLE_WEBHOOK_STATUS,
    id: stripeEventIds,
    createdAt: { lt: retryWindowEnd, gte: retentionStart },
  }
  const batch = await prisma.processedWebhook.findMany({
    where: replayableWhere,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, error: true },
  })
  if (batch.length === limit) {
    result.deferred = Math.max(0, (await prisma.processedWebhook.count({ where: replayableWhere })) - batch.length)
  }

  const stripe = batch.length > 0 ? getStripeClient() : null

  for (let index = 0; index < batch.length; index += 1) {
    const row = batch[index]!
    if (Date.now() - startedAt > timeBudgetMs) {
      result.deferred += batch.length - index
      break
    }
    result.scanned += 1

    let event: Stripe.Event
    try {
      event = await stripe!.events.retrieve(row.id)
    } catch (error) {
      if (isEventGone(error)) {
        await prisma.processedWebhook.updateMany({
          where: { id: row.id, status: REPLAYABLE_WEBHOOK_STATUS },
          data: { status: EXPIRED_WEBHOOK_STATUS },
        })
        result.expired += 1
        result.expiredIds.push(row.id)
        continue
      }
      // Network / rate limit / Stripe outage: the row stays `failed`, the next run tries again.
      result.stillFailing += 1
      result.failures.push({ eventId: row.id, type: null, error: `stripe_retrieve_failed: ${errorMessage(error)}` })
      continue
    }

    try {
      const outcome = await processStripeWebhookEvent(event)
      if (outcome.duplicate) {
        result.alreadyHandled += 1
      } else if (outcome.status === "failed") {
        result.stillFailing += 1
        const stored = await prisma.processedWebhook.findUnique({ where: { id: row.id } })
        result.failures.push({
          eventId: row.id,
          type: event.type,
          error: (stored?.error ?? row.error ?? "failed").slice(0, 300),
        })
      } else {
        result.replayed += 1
        logStripeWebhookInfo({ metric: "stripe_webhook_replayed", eventId: row.id, type: event.type, status: outcome.status })
      }
    } catch (error) {
      result.stillFailing += 1
      result.failures.push({ eventId: row.id, type: event.type, error: errorMessage(error) })
    }
  }

  if (result.stillFailing > 0) {
    const listed = result.failures
      .slice(0, ALERT_LIST_MAX)
      .map((f) => `${f.eventId}${f.type ? ` (${f.type})` : ""}: ${f.error.slice(0, 120)}`)
      .join(" | ")
    await alertOps(
      `🚨 ${result.stillFailing} Stripe webhook event(s) STILL failing after a replay (Stripe stopped retrying them): ${listed}` +
        (result.failures.length > ALERT_LIST_MAX ? ` … +${result.failures.length - ALERT_LIST_MAX}` : ""),
      { stillFailing: result.stillFailing, eventIds: result.failures.map((f) => f.eventId).slice(0, 50) }
    )
  }
  if (result.expired > 0) {
    await alertOps(
      `🚨 ${result.expired} Stripe webhook event(s) failed and can never be replayed (older than ${STRIPE_EVENT_RETENTION_DAYS} days or gone at Stripe): ` +
        `${result.expiredIds.slice(0, ALERT_LIST_MAX).join(", ")}. Reconcile the payments / refunds / disputes of these events by hand.`,
      { expired: result.expired, eventIds: result.expiredIds.slice(0, 50) }
    )
  }

  logStripeWebhookInfo({
    metric: "stripe_webhook_replay_run",
    scanned: result.scanned,
    replayed: result.replayed,
    alreadyHandled: result.alreadyHandled,
    stillFailing: result.stillFailing,
    expired: result.expired,
    deferred: result.deferred,
    duration_ms: Date.now() - startedAt,
  })

  return result
}
