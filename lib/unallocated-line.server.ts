import * as Sentry from "@sentry/nextjs"
import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import {
  UNALLOCATED_LINE_AUDIT_ACTION,
  UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
  UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
  UNALLOCATED_LINE_REFUND_METADATA_KEY,
  computeUnallocatedLineRefundCents,
  isUnallocatedLineAutoRefundEnabled,
  unallocatedLineAuditId,
  unallocatedLineKey,
  unallocatedLineRefundedAuditId,
  type UnallocatedLine,
} from "@/lib/unallocated-line"

/** The part of the Checkout Session this module needs (everything the webhook already has in hand). */
export type UnallocatedLineSession = Pick<
  Stripe.Checkout.Session,
  "id" | "currency" | "payment_intent" | "amount_total" | "amount_subtotal" | "total_details"
>

export type UnallocatedLineOutcome = {
  key: string
  /** `existing`: a previous run already left the trace (a replay) — no second alert. */
  trace: "created" | "existing" | "failed"
  refund:
    | "disabled"
    | "no_amount"
    | "no_payment_intent"
    | "already_refunded"
    | "refunded"
    | "failed"
  stripeRefundId?: string
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function paymentIntentId(session: UnallocatedLineSession): string | null {
  const pi = session.payment_intent
  const id = typeof pi === "string" ? pi : pi?.id
  return id?.trim() ? id.trim() : null
}

function money(cents: number | null, currency: string): string {
  return cents == null ? "unknown amount" : `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
}

async function raiseAlert(message: string, context: Record<string, unknown>): Promise<void> {
  // Slack / Discord (only when SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL are set) — never throws, never blocks.
  try {
    await opsWebhookAlert(message)
  } catch {
    // an alert channel being down must not break the payment flow
  }
  try {
    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureMessage(message, { level: "error", extra: context })
    }
  } catch {
    // same
  }
}

/**
 * Which of these checkout lines were already refunded automatically. Read BEFORE the fulfilment transaction so that a
 * line whose money went back to the buyer is never turned into an order afterwards (stock replenished, listing
 * re-activated…). Never throws: a read failure means "unknown" and must not block the payment processing.
 */
export async function loadRefundedUnallocatedLineKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  try {
    const rows = await prisma.auditLog.findMany({
      where: { id: { in: keys.map(unallocatedLineRefundedAuditId) } },
      select: { id: true },
    })
    const refundedIds = new Set(rows.map((r) => r.id))
    return new Set(keys.filter((k) => refundedIds.has(unallocatedLineRefundedAuditId(k))))
  } catch (error) {
    logStripeWebhookError({ metric: "unallocated_line_refunded_lookup_failed", error: errorMessage(error) })
    return new Set()
  }
}

/**
 * What to do with paid lines that produced no order (D6 / G1 shortfall). For EACH line, independently — one failing
 * line never stops the next one, and the caller has already finished the orders of the other lines:
 *  1. durable trace in `AuditLog` (deterministic id → idempotent: a replay does not duplicate it nor re-alert);
 *  2. alert (Slack/Discord webhook + Sentry) the first time the line is seen;
 *  3. automatic partial refund of the line — ONLY when `UNALLOCATED_LINE_AUTO_REFUND=true`.
 * Never throws.
 */
export async function recordUnallocatedLines(args: {
  session: UnallocatedLineSession
  lines: UnallocatedLine[]
  /** Store credit redeemed for the whole checkout: not re-credited automatically, so it goes in the trace for ops. */
  appliedRewardCents?: number
}): Promise<UnallocatedLineOutcome[]> {
  const outcomes: UnallocatedLineOutcome[] = []
  for (const line of args.lines) {
    try {
      outcomes.push(await recordOneLine(args.session, line, args.appliedRewardCents ?? 0))
    } catch (error) {
      const key = unallocatedLineKey(args.session.id, line.lineIndex)
      logStripeWebhookError({ metric: "unallocated_line_handler_failed", key, error: errorMessage(error) })
      outcomes.push({ key, trace: "failed", refund: "failed" })
    }
  }
  return outcomes
}

async function recordOneLine(
  session: UnallocatedLineSession,
  line: UnallocatedLine,
  appliedRewardCents: number
): Promise<UnallocatedLineOutcome> {
  const key = unallocatedLineKey(session.id, line.lineIndex)
  const currency = (session.currency ?? "eur").toLowerCase()
  const refundCents = computeUnallocatedLineRefundCents({
    paidLineCents: line.paidLineCents,
    checkoutSubtotalCents: session.amount_subtotal ?? session.amount_total ?? 0,
    checkoutTaxCents: session.total_details?.amount_tax ?? 0,
    checkoutAmountTotalCents: session.amount_total ?? 0,
  })
  const autoRefundEnabled = isUnallocatedLineAutoRefundEnabled()
  const piId = paymentIntentId(session)

  // 1. Durable trace.
  let trace: UnallocatedLineOutcome["trace"] = "created"
  try {
    await prisma.auditLog.create({
      data: {
        id: unallocatedLineAuditId(key),
        action: UNALLOCATED_LINE_AUDIT_ACTION,
        entityType: UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
        entityId: key,
        payload: {
          checkoutSessionId: session.id,
          lineIndex: line.lineIndex,
          reason: line.reason,
          affiliateProductId: line.affiliateProductId,
          productId: line.productId,
          qty: line.qty,
          paidLineCents: line.paidLineCents,
          refundableCents: refundCents,
          currency,
          paymentIntentId: piId,
          appliedRewardCents,
          autoRefundEnabled,
          ...(line.detail ? { detail: line.detail } : {}),
        } as Prisma.InputJsonObject,
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      trace = "existing"
    } else {
      trace = "failed"
      logStripeWebhookError({ metric: "unallocated_line_trace_failed", key, error: errorMessage(error) })
    }
  }

  // 2. Alert — once per line (a replay finds the trace and stays quiet; a trace that could not be written still alerts).
  if (trace !== "existing") {
    const message =
      `[Affisell] UNALLOCATED_LINE session=${session.id} line=${line.lineIndex} reason=${line.reason} ` +
      `paid=${money(refundCents, currency)} auto_refund=${autoRefundEnabled ? "on" : "off"} — ` +
      `the buyer paid for a line that has NO order; refund it or create the order by hand.`
    logStripeWebhookError({
      metric: "unallocated_line",
      key,
      sessionId: session.id,
      lineIndex: line.lineIndex,
      reason: line.reason,
      refundableCents: refundCents,
      autoRefundEnabled,
      trace,
    })
    await raiseAlert(message, { key, reason: line.reason, refundableCents: refundCents, appliedRewardCents })
  } else {
    logStripeWebhookInfo({ metric: "unallocated_line_known", key, reason: line.reason })
  }

  // 3. Automatic refund, off unless explicitly enabled.
  if (!autoRefundEnabled) return { key, trace, refund: "disabled" }
  if (refundCents == null || refundCents <= 0) return { key, trace, refund: "no_amount" }
  if (!piId) return { key, trace, refund: "no_payment_intent" }

  const refundedAuditId = unallocatedLineRefundedAuditId(key)
  const already = await prisma.auditLog.findUnique({ where: { id: refundedAuditId }, select: { id: true } })
  if (already) return { key, trace, refund: "already_refunded" }

  let refundId: string
  try {
    const refund = await getStripeClient().refunds.create(
      {
        payment_intent: piId,
        amount: refundCents,
        reason: "requested_by_customer",
        metadata: {
          // Read by the charge.refunded handler: this refund belongs to NO order of the charge.
          [UNALLOCATED_LINE_REFUND_METADATA_KEY]: "1",
          source: "unallocated_line",
          checkoutSessionId: session.id,
          lineIndex: String(line.lineIndex),
          reasonCode: line.reason,
        },
      },
      // Stripe replays the same refund for the same key (at least 24 h); the `refunded` trace covers the long term.
      { idempotencyKey: `unallocated-line-refund:${key}` }
    )
    refundId = refund.id
  } catch (error) {
    logStripeWebhookError({ metric: "unallocated_line_refund_failed", key, error: errorMessage(error) })
    await raiseAlert(
      `[Affisell] UNALLOCATED_LINE automatic refund FAILED session=${session.id} line=${line.lineIndex}: ${errorMessage(error)}`,
      { key }
    )
    return { key, trace, refund: "failed" }
  }

  try {
    await prisma.auditLog.create({
      data: {
        id: refundedAuditId,
        action: UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
        entityType: UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
        entityId: key,
        payload: { checkoutSessionId: session.id, lineIndex: line.lineIndex, stripeRefundId: refundId, amountCents: refundCents, currency },
      },
    })
  } catch (error) {
    if (!isUniqueViolation(error)) {
      logStripeWebhookError({ metric: "unallocated_line_refund_trace_failed", key, refundId, error: errorMessage(error) })
    }
  }
  await raiseAlert(
    `[Affisell] UNALLOCATED_LINE refunded session=${session.id} line=${line.lineIndex} ${money(refundCents, currency)} (refund ${refundId})`,
    { key, refundId }
  )
  return { key, trace, refund: "refunded", stripeRefundId: refundId }
}
