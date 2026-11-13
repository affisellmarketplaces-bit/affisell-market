import * as Sentry from "@sentry/nextjs"
import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { opsWebhookAlert } from "@/lib/ops-webhook"
import { isOrderClosedForPayout, orderIsFulfilledForCheckout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import {
  UNALLOCATED_LINE_ALERTED_AUDIT_ACTION,
  UNALLOCATED_LINE_AUDIT_ACTION,
  UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
  UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
  UNALLOCATED_LINE_REFUND_METADATA_KEY,
  buildUnallocatedLineTraceRow,
  computeUnallocatedLineRefundCents,
  isUnallocatedLineAutoRefundEnabled,
  unallocatedLineAlertedAuditId,
  unallocatedLineAuditId,
  unallocatedLineKey,
  unallocatedLineRefundedAuditId,
  type TracedUnallocatedLine,
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

export async function raiseOpsAlert(message: string, context: Record<string, unknown>): Promise<void> {
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

  // 1. Durable trace. Normally it already exists: the fulfilment wrote it INSIDE its own transaction
  // (`writeUnallocatedTracesInTransaction`), so it survives whatever happens to this after-response task. This write
  // covers the paths that have no transaction (and heals a missing row): same row, same deterministic id.
  let trace: UnallocatedLineOutcome["trace"] = "created"
  const row = buildUnallocatedLineTraceRow({ session, line, appliedRewardCents, autoRefundEnabled })
  try {
    await prisma.auditLog.create({
      data: {
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload as Prisma.InputJsonObject,
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

  // 2. Alert — once per line. "Alerted" is its own deterministic row (the trace is written before the response, the alert
  // after it): a replay finds it and stays quiet; a lost after-response task leaves it missing and the next pass alerts.
  const alertedId = unallocatedLineAlertedAuditId(key)
  const alreadyAlerted = await prisma.auditLog
    .findUnique({ where: { id: alertedId }, select: { id: true } })
    .then((r) => Boolean(r))
    .catch(() => false)
  if (!alreadyAlerted) {
    const message =
      `[Affisell] UNALLOCATED_LINE session=${session.id} line=${line.lineIndex} reason=${line.reason} ` +
      `paid=${money(refundCents, currency)} auto_refund=${autoRefundEnabled ? "on" : "off"} payment_intent=${piId ?? "unknown"} — ` +
      `the buyer paid for a line that has NO order. Refund EXACTLY ${money(refundCents, currency)} on that payment ` +
      `in the Stripe dashboard (a refund of that exact amount is recognised as this line's and never applied to the ` +
      `other orders of the checkout), or create the order by hand.`
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
    await raiseOpsAlert(message, { key, reason: line.reason, refundableCents: refundCents, appliedRewardCents })
    try {
      await prisma.auditLog.create({
        data: {
          id: alertedId,
          action: UNALLOCATED_LINE_ALERTED_AUDIT_ACTION,
          entityType: UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
          entityId: key,
          payload: { checkoutSessionId: session.id, lineIndex: line.lineIndex, reason: line.reason },
        },
      })
    } catch (error) {
      if (!isUniqueViolation(error)) {
        logStripeWebhookError({ metric: "unallocated_line_alerted_mark_failed", key, error: errorMessage(error) })
      }
    }
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

  // The proof row may be missing (its write failed after Stripe accepted the refund) and Stripe forgets an idempotency
  // key after 24 h: look at what the payment already carries before creating another refund.
  const held = await findHeldLineRefund(piId, session.id, line.lineIndex)
  if (held) {
    await writeRefundedProof(refundedAuditId, session.id, line.lineIndex, held.id, held.amount, currency, "automatic_recovered")
    return { key, trace, refund: "already_refunded", stripeRefundId: held.id }
  }

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
    await raiseOpsAlert(
      `[Affisell] UNALLOCATED_LINE automatic refund FAILED session=${session.id} line=${line.lineIndex}: ${errorMessage(error)}`,
      { key }
    )
    return { key, trace, refund: "failed" }
  }

  await writeRefundedProof(refundedAuditId, session.id, line.lineIndex, refundId, refundCents, currency, "automatic")
  await raiseOpsAlert(
    `[Affisell] UNALLOCATED_LINE refunded session=${session.id} line=${line.lineIndex} ${money(refundCents, currency)} (refund ${refundId})`,
    { key, refundId }
  )
  return { key, trace, refund: "refunded", stripeRefundId: refundId }
}

/** A refund this module already created for the line, still held by the payment (Stripe lists the last 100). */
async function findHeldLineRefund(
  piId: string,
  sessionId: string,
  lineIndex: number
): Promise<{ id: string; amount: number } | null> {
  try {
    const list = await getStripeClient().refunds.list({ payment_intent: piId, limit: 100 })
    const hit = (list?.data ?? []).find(
      (r) =>
        r.metadata?.[UNALLOCATED_LINE_REFUND_METADATA_KEY] === "1" &&
        r.metadata?.checkoutSessionId === sessionId &&
        r.metadata?.lineIndex === String(lineIndex) &&
        r.status !== "failed" &&
        r.status !== "canceled"
    )
    return hit ? { id: hit.id, amount: hit.amount } : null
  } catch (error) {
    // Unreadable: carry on with the idempotency key (same refund within 24 h) rather than block the refund.
    logStripeWebhookError({ metric: "unallocated_line_refund_lookup_failed", piId, error: errorMessage(error) })
    return null
  }
}

/** The proof that a line went back to the buyer; deterministic id, a second write is a no-op. Never throws. */
async function writeRefundedProof(
  auditId: string,
  sessionId: string,
  lineIndex: number,
  stripeRefundId: string,
  amountCents: number,
  currency: string,
  source: "automatic" | "automatic_recovered" | "manual_dashboard"
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: auditId,
        action: UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION,
        entityType: UNALLOCATED_LINE_AUDIT_ENTITY_TYPE,
        entityId: unallocatedLineKey(sessionId, lineIndex),
        payload: { checkoutSessionId: sessionId, lineIndex, stripeRefundId, amountCents, currency, source },
      },
    })
  } catch (error) {
    if (!isUniqueViolation(error)) {
      logStripeWebhookError({
        metric: "unallocated_line_refund_trace_failed",
        key: unallocatedLineKey(sessionId, lineIndex),
        refundId: stripeRefundId,
        error: errorMessage(error),
      })
    }
  }
}

/**
 * The traced unallocated lines of a payment (found by the payment intent stored in the trace) and what is known about
 * their refund. Used by the `charge.refunded` handler to tell a refund of such a line from a refund of an order.
 * Throws on a database error ON PURPOSE: the webhook then fails and is replayed, instead of guessing.
 */
export async function loadTracedUnallocatedLinesForPaymentIntent(piId: string): Promise<TracedUnallocatedLine[]> {
  const traces = await prisma.auditLog.findMany({
    where: { action: UNALLOCATED_LINE_AUDIT_ACTION, payload: { path: ["paymentIntentId"], equals: piId } },
    select: { entityId: true, payload: true },
  })
  const lines = traces.filter((t) => t.entityId)
  if (lines.length === 0) return []
  const refunded = await prisma.auditLog.findMany({
    where: { id: { in: lines.map((t) => unallocatedLineRefundedAuditId(t.entityId!)) } },
    select: { entityId: true, payload: true },
  })
  const refundIdByKey = new Map(
    refunded.map((r) => {
      const p = r.payload as { stripeRefundId?: unknown } | null
      return [r.entityId!, typeof p?.stripeRefundId === "string" ? p.stripeRefundId : "unknown"] as const
    })
  )
  return lines.map((t) => {
    const p = t.payload as { refundableCents?: unknown } | null
    return {
      key: t.entityId!,
      refundableCents: typeof p?.refundableCents === "number" ? p.refundableCents : null,
      refundedByRefundId: refundIdByKey.get(t.entityId!) ?? null,
    }
  })
}

/** A refund made by hand was matched to a traced line: leave the proof, so the line can never become an order. */
export async function recordManualUnallocatedRefund(args: {
  lineKey: string
  stripeRefundId: string
  amountCents: number
  currency: string
}): Promise<void> {
  const sep = args.lineKey.lastIndexOf(":line:")
  if (sep < 0) return
  const sessionId = args.lineKey.slice(0, sep)
  const lineIndex = Number(args.lineKey.slice(sep + ":line:".length))
  await writeRefundedProof(
    unallocatedLineRefundedAuditId(args.lineKey),
    sessionId,
    lineIndex,
    args.stripeRefundId,
    args.amountCents,
    args.currency,
    "manual_dashboard"
  )
  await raiseOpsAlert(
    `[Affisell] UNALLOCATED_LINE refund recognised by its amount: ${args.stripeRefundId} (${(args.amountCents / 100).toFixed(2)} ${args.currency.toUpperCase()}) ` +
      `matched to ${args.lineKey}. If it was meant for another order of that checkout, fix it by hand.`,
    { lineKey: args.lineKey, stripeRefundId: args.stripeRefundId }
  )
}

/** A refund on a charge that carries unallocated lines could not be attributed: nothing was changed, ops decide. */
export async function alertUnattributedChargeRefund(args: {
  chargeId: string
  stripeRefundId: string
  amountCents: number
}): Promise<void> {
  logStripeWebhookError({
    metric: "refund_unattributed_unallocated_charge",
    chargeId: args.chargeId,
    stripeRefundId: args.stripeRefundId,
    amountCents: args.amountCents,
  })
  await raiseOpsAlert(
    `[Affisell] Refund ${args.stripeRefundId} (${(args.amountCents / 100).toFixed(2)}) on charge ${args.chargeId} was NOT applied to any order: ` +
      `the charge also carries a paid line with no order and the refund matches neither it (by amount) nor a named order. ` +
      `No payout was touched; reconcile it by hand (refund the order through the app, or re-issue the line refund with the exact traced amount).`,
    { chargeId: args.chargeId, stripeRefundId: args.stripeRefundId }
  )
}

/**
 * Writes the traces of unallocated lines INSIDE the caller's transaction — the one that closes the order / creates the other
 * lines' orders — so "order closed" and "trace written" are ONE atomic fact: a pre-created order closed without its trace
 * (the after-response task never ran, the database blinked) would be invisible to every later pass (the closed order is
 * skipped by the fulfilment and the cron only looks at PENDING rows). Idempotent: `createMany` with `skipDuplicates` is an
 * `INSERT … ON CONFLICT DO NOTHING` (catching a unique violation inside a transaction would abort it). The alert and the
 * refund stay after the response (`recordUnallocatedLines`). A failure here fails the transaction on purpose.
 */
export async function writeUnallocatedTracesInTransaction(
  tx: Pick<Prisma.TransactionClient, "auditLog">,
  args: { session: UnallocatedLineSession; lines: UnallocatedLine[]; appliedRewardCents?: number }
): Promise<void> {
  if (args.lines.length === 0) return
  const autoRefundEnabled = isUnallocatedLineAutoRefundEnabled()
  await tx.auditLog.createMany({
    data: args.lines.map((line) => {
      const row = buildUnallocatedLineTraceRow({
        session: args.session,
        line,
        appliedRewardCents: args.appliedRewardCents ?? 0,
        autoRefundEnabled,
      })
      return {
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload as Prisma.InputJsonObject,
      }
    }),
    skipDuplicates: true,
  })
}

/** The order facts `reportPaidSessionOnClosedOrders` reads. */
export type ClosedOrderFacts = {
  id: string
  stripeSessionId: string
  status: string | null
  paymentSettlementStatus: string | null
  paidAt?: Date | null
  bookingSlotId?: string | null
  sellingPriceCents?: number | null
  quantity?: number | null
  currency?: string | null
  affiliateProductId?: string | null
  productId?: string | null
}

/**
 * A PAID session whose orders are ALL closed or never became sales, with nothing accounting for it, used to be swallowed
 * without a word (the fulfilment gate returns for a closed order). The case: an order cancelled while still unpaid (admin
 * cancel — nothing expires the Stripe session, it stays payable ~24 h) and then paid. Nobody was told, nothing was traced,
 * nothing was refunded. A closure is ACCOUNTED FOR (silent) when the order was ever paid (`paidAt`), when its money went
 * back (refunded / refund settlement states), when it is a booking order (its hold has its own release), or when the
 * unallocated-line trace already exists (the skeleton closed by the unallocated-line rule). Otherwise the line is recorded
 * as `order_closed_before_payment`: durable trace (deterministic id), ONE alert (an "alerted" row), automatic refund only
 * with the flag. Never throws; replays are quiet.
 */
export async function reportPaidSessionOnClosedOrders(args: {
  sessionId: string
  orders: ClosedOrderFacts[]
  /** The full session when the caller has it (payment intent, amounts); otherwise a minimal one is built. */
  session?: UnallocatedLineSession
}): Promise<void> {
  try {
    const norm = (v: string | null | undefined) => (v ?? "").trim()
    // Anything that is a sale already: nothing to report.
    if (args.orders.some((o) => orderIsFulfilledForCheckout(o))) return
    for (const order of args.orders) {
      if (!isOrderClosedForPayout(order)) continue
      const settlement = norm(order.paymentSettlementStatus).toUpperCase()
      const refundedBack =
        norm(order.status).toLowerCase() === "refunded" ||
        settlement === "REFUNDED" ||
        settlement === "REFUND_PENDING_CLAWBACK" ||
        settlement === "PARTIALLY_REFUNDED"
      if (order.paidAt || refundedBack || order.bookingSlotId) continue

      const sep = order.stripeSessionId.lastIndexOf(":line:")
      const lineIndex = sep >= 0 ? Number(order.stripeSessionId.slice(sep + ":line:".length)) || 0 : 0
      const key = unallocatedLineKey(args.sessionId, lineIndex)
      const traced = await prisma.auditLog.findUnique({
        where: { id: unallocatedLineAuditId(key) },
        select: { payload: true },
      })
      if (traced) {
        // The unallocated-line rule closed it and its trace exists (written in the fulfilment transaction). If the
        // after-response task that alerts / refunds never ran (instance cut, database blip), no row says "alerted": do it
        // now — same alert path, one alert, refund only with the flag. Otherwise nothing to do.
        const alerted = await prisma.auditLog.findUnique({
          where: { id: unallocatedLineAlertedAuditId(key) },
          select: { id: true },
        })
        if (!alerted) await recordUnallocatedLines(healFromTrace(args.sessionId, lineIndex, traced.payload, args.session))
        continue
      }

      await recordUnallocatedLines({
        session: args.session ?? {
          id: args.sessionId,
          currency: order.currency ?? "eur",
          payment_intent: null,
          amount_total: null,
          amount_subtotal: null,
          total_details: null,
        },
        lines: [
          {
            lineIndex,
            reason: "order_closed_before_payment",
            affiliateProductId: order.affiliateProductId ?? null,
            productId: order.productId ?? null,
            qty: order.quantity ?? 1,
            paidLineCents: order.sellingPriceCents ?? null,
            detail: { orderId: order.id, orderStatus: order.status, orderSettlementStatus: order.paymentSettlementStatus },
          },
        ],
      })
    }
  } catch (error) {
    logStripeWebhookError({ metric: "closed_order_paid_session_report_failed", sessionId: args.sessionId, error: errorMessage(error) })
  }
}

/** Rebuilds what `recordUnallocatedLines` needs from a stored trace (the exact refundable amount is kept in the payload). */
function healFromTrace(
  sessionId: string,
  lineIndex: number,
  payload: unknown,
  session?: UnallocatedLineSession
): { session: UnallocatedLineSession; lines: UnallocatedLine[]; appliedRewardCents: number } {
  const p = (payload ?? {}) as Record<string, unknown>
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
  const paid = num(p.paidLineCents)
  const refundable = num(p.refundableCents)
  return {
    // `amount_subtotal` / `amount_total` are chosen so the line's refundable amount comes out EXACTLY as it was traced.
    session:
      session ?? {
        id: sessionId,
        currency: str(p.currency) ?? "eur",
        payment_intent: str(p.paymentIntentId),
        amount_subtotal: paid,
        amount_total: refundable,
        total_details: { amount_tax: refundable != null && paid != null ? Math.max(0, refundable - paid) : 0 } as never,
      },
    appliedRewardCents: num(p.appliedRewardCents) ?? 0,
    lines: [
      {
        lineIndex,
        reason: (str(p.reason) as UnallocatedLine["reason"] | null) ?? "order_closed_before_payment",
        affiliateProductId: str(p.affiliateProductId),
        productId: str(p.productId),
        qty: num(p.qty) ?? 1,
        paidLineCents: paid,
        ...(p.detail && typeof p.detail === "object" ? { detail: p.detail as Record<string, unknown> } : {}),
      },
    ],
  }
}
