import * as Sentry from "@sentry/nextjs"
import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { calculateRefundSplit, orderToCommissionRefundSlice } from "@/lib/commission"
import { orderChargedTotalCents } from "@/lib/money/split-guard"
import { clawbackOrderPayoutsOnRefund } from "@/lib/order-payout"
import {
  allocateDisputeLoss,
  disputeOutcomeFromStripeStatus,
  type DisputeOutcome,
} from "@/lib/orders/dispute-state"
import {
  closeDisputeHold,
  DISPUTE_HOLD_STATUS,
  hasOpenDisputeHold,
  openDisputeHold,
  readDisputeHold,
} from "@/lib/orders/dispute-hold.server"
import {
  isOrderClosedForPayout,
  statusWhenDisputeOpens,
  statusWhenDisputeReleased,
} from "@/lib/orders/payment-state"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import {
  alertClawbackBlocked,
  evaluateClawbackSafety,
  markRefundPendingClawback,
} from "@/lib/payout-reversal-safety"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { reverseConnectTransfersForRefund } from "@/lib/stripe-transfer-reversal"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

/**
 * Stripe payment disputes (chargebacks) — finalisation master doc, D7.
 *
 * Events: `charge.dispute.created | updated | closed | funds_withdrawn | funds_reinstated`. They are handled by the dispute's
 * STATUS, not by the event name: Stripe does not guarantee ordering, and every event carries the dispute as it was when it
 * was emitted. The rules that make that safe:
 *  - OPEN (needs_response, under_review, warning_*): every order of the charge is HELD — `Order.status = "disputed"` plus an
 *    open row in the dispute ledger (`lib/orders/dispute-hold.server.ts`), which is what the payout release asks. Pending
 *    transfers are kept, not cancelled. Nothing already paid out is pulled back yet: the bank decides first.
 *  - WON / closed without loss: the hold is released and the order gets back the status it had (exactly, from the ledger).
 *  - LOST: the charge is gone. Only when the disputed amount equals what our orders account for is it applied
 *    automatically, with the refund mechanisms that already exist: Connect transfer reversals, `OrderStripeRefund` (so the
 *    `retry-pending-clawback` cron can finish a reversal that failed), the clawback ledger, `REFUNDED` /
 *    `REFUND_PENDING_CLAWBACK`. Nothing is invented: a reversal can never exceed what was transferred, and any amount that
 *    does not add up (partial dispute, order missing from the lookup, other currency) keeps the hold open and alerts a human.
 *    Stripe's dispute fee is not allocated to anybody.
 *  - A terminal ledger row is never reopened, a late `created` replayed after `closed` changes nothing, and every write is
 *    ordered so that a replay after a mid-way failure converges (effects first, the terminal ledger row last).
 */

export const STRIPE_DISPUTE_EVENT_TYPES = [
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
] as const

export function isStripeDisputeEventType(type: string): boolean {
  return (STRIPE_DISPUTE_EVENT_TYPES as readonly string[]).includes(type)
}

export type DisputeEventOutcome = {
  orderId: string | null
  status: "success" | "failed" | "skipped"
  error: string | null
}

type Tx = Prisma.TransactionClient

const ORDER_SELECT = {
  id: true,
  status: true,
  paymentSettlementStatus: true,
  shippedAt: true,
  trackingNumber: true,
  supplierPreparingAt: true,
  totalCents: true,
  subtotalCents: true,
  sellingPriceCents: true,
  platformCommissionCents: true,
  taxCents: true,
  currency: true,
} satisfies Prisma.OrderSelect

type DisputeOrder = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === "string" && id.trim() !== "") return id.trim()
  }
  return null
}

/** Refund-ledger key for a lost dispute on one order (`OrderStripeRefund.stripeRefundId` is unique across orders). */
export function lostDisputeRefundKey(disputeId: string, orderId: string): string {
  return `${disputeId}:${orderId}`
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Ops alert (Slack / Discord) + Sentry. Never throws and never holds the webhook transaction for more than 2.5 s. */
async function alertDispute(
  level: "error" | "warning" | "info",
  text: string,
  extra: Record<string, unknown>
): Promise<void> {
  logStripeWebhookInfo({ metric: "stripe_dispute_alert", level, text, ...extra })
  if (level !== "info" && process.env.SENTRY_DSN?.trim()) {
    try {
      Sentry.captureMessage(`Stripe dispute: ${text.slice(0, 160)}`, { level, extra })
    } catch {
      // alerting must never break the webhook
    }
  }
  try {
    await withTimeout(opsWebhookAlert(text), 2500)
  } catch {
    // alerting must never break the webhook
  }
}

function centsLabel(cents: number | null | undefined, currency: string | null | undefined): string {
  const amount = Math.round(Number(cents ?? 0)) / 100
  return `${amount.toFixed(2)} ${(currency ?? "").toUpperCase()}`.trim()
}

/**
 * Every order paid by the disputed charge: by charge id, by PaymentIntent id, and — for a multi-line cart, where the
 * orders of one charge are siblings of one Checkout Session — through the session(s) of the PaymentIntent.
 */
async function findOrderIdsForDispute(dispute: Stripe.Dispute): Promise<string[]> {
  const chargeId = stripeObjectId(dispute.charge)
  const paymentIntentId = stripeObjectId(dispute.payment_intent)
  const ids = new Set<string>()

  const direct: Prisma.OrderWhereInput[] = []
  if (chargeId) direct.push({ stripeChargeId: chargeId })
  if (paymentIntentId) direct.push({ stripePaymentIntentId: paymentIntentId })
  if (direct.length > 0) {
    const rows = await prisma.order.findMany({ where: { OR: direct }, select: { id: true } })
    for (const row of rows) ids.add(row.id)
  }

  if (paymentIntentId) {
    const stripe = getStripeClient()
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 20 })
    const sessionIds = sessions.data.map((s) => s.id).filter(Boolean)
    if (sessionIds.length > 0) {
      const rows = await prisma.order.findMany({
        where: {
          OR: sessionIds.flatMap((sid) => [
            { stripeSessionId: sid },
            { stripeSessionId: { startsWith: `${sid}:line:` } },
          ]),
        },
        select: { id: true },
      })
      for (const row of rows) ids.add(row.id)
    }
  }

  return [...ids]
}

async function handleDisputeOpen(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  orders: DisputeOrder[],
  tx: Tx
): Promise<DisputeEventOutcome> {
  const newlyHeld: string[] = []
  const alreadyRefunded: string[] = []

  for (const order of orders) {
    if (isOrderClosedForPayout(order)) {
      // Refunded / cancelled already: there is nothing left to hold, but the buyer may be paid twice (refund + chargeback).
      alreadyRefunded.push(order.id)
      continue
    }
    const previousStatus = order.status.trim() || null
    const hold = await openDisputeHold(tx, { disputeId: dispute.id, orderId: order.id, previousStatus })
    if (hold === "already_closed") continue

    // Also re-asserted on an "already_open" hold: another writer may have overwritten "disputed" in the meantime.
    const nextStatus = statusWhenDisputeOpens(order)
    if (nextStatus) {
      await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } })
    }
    if (hold === "created") newlyHeld.push(order.id)
  }

  if (newlyHeld.length > 0) {
    await alertDispute(
      "error",
      `🚨 Stripe dispute ${dispute.id} opened on ${newlyHeld.length} order(s) ${newlyHeld.join(", ")} — ` +
        `${centsLabel(dispute.amount, dispute.currency)}, reason ${dispute.reason}, status ${dispute.status}. ` +
        `Payouts are HELD (nothing is released while it is open). Answer in the Stripe dashboard before the evidence deadline.`,
      { disputeId: dispute.id, orderIds: newlyHeld, eventId: event.id, reason: dispute.reason }
    )
  }
  if (alreadyRefunded.length > 0 && event.type === "charge.dispute.created") {
    await alertDispute(
      "error",
      `🚨 Stripe dispute ${dispute.id} on order(s) ${alreadyRefunded.join(", ")} that were ALREADY refunded or cancelled — ` +
        `${centsLabel(dispute.amount, dispute.currency)}. Answer it with the refund proof, otherwise the buyer is paid twice.`,
      { disputeId: dispute.id, orderIds: alreadyRefunded, eventId: event.id }
    )
  }

  return { orderId: orders[0]?.id ?? null, status: "success", error: null }
}

async function handleDisputeReleased(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  outcome: "won" | "closed",
  orders: DisputeOrder[],
  tx: Tx
): Promise<DisputeEventOutcome> {
  const released: string[] = []

  for (const order of orders) {
    const hold = await readDisputeHold(tx, dispute.id, order.id)
    if (hold && hold.status !== DISPUTE_HOLD_STATUS.open) continue // terminal already: replay / duplicate

    // Restore the status FIRST and close the ledger row LAST: if something fails in between, the hold stays open (the
    // money stays held) and the replay finishes the job. The other order of events could leave "disputed" with no hold.
    const stillHeldByAnotherDispute = await hasOpenDisputeHold(order.id, tx, { exceptDisputeId: dispute.id })
    const restored = stillHeldByAnotherDispute ? null : statusWhenDisputeReleased(order, hold?.previousStatus)
    if (restored) {
      await tx.order.update({ where: { id: order.id }, data: { status: restored } })
    }
    await closeDisputeHold(tx, { disputeId: dispute.id, orderId: order.id, outcome })
    if (hold) released.push(order.id)
  }

  if (released.length > 0) {
    await alertDispute(
      "info",
      outcome === "won"
        ? `✅ Stripe dispute ${dispute.id} WON — hold released on order(s) ${released.join(", ")}; payouts can resume.`
        : `ℹ️ Stripe dispute ${dispute.id} closed without a chargeback (${dispute.status}) — hold released on order(s) ${released.join(", ")}.`,
      { disputeId: dispute.id, orderIds: released, eventId: event.id }
    )
  }

  return { orderId: orders[0]?.id ?? null, status: "success", error: null }
}

/** The refund mechanisms, applied to ONE order whose whole charge was lost. Idempotent (every step is keyed). */
async function applyFullDisputeLoss(
  dispute: Stripe.Dispute,
  order: DisputeOrder,
  tx: Tx
): Promise<"refunded" | "pending_clawback"> {
  const totalCents = orderChargedTotalCents(order)
  const refundKey = lostDisputeRefundKey(dispute.id, order.id)

  // 1. Pull back what already left through Connect transfers (never more than was transferred: see computeIncrementalReversalCents).
  await reverseConnectTransfersForRefund({
    orderId: order.id,
    stripeRefundId: refundKey,
    refundAmountCents: totalCents,
    orderTotalCents: totalCents,
    isFullRefund: true,
    refundKey,
  })

  // 2. Same ledger row as a refund: it is what lets the `retry-pending-clawback` cron re-run a reversal that failed.
  const alreadyRecorded = await prisma.orderStripeRefund.findUnique({ where: { stripeRefundId: refundKey } })
  if (!alreadyRecorded) {
    const slice = orderToCommissionRefundSlice({ ...order, totalCents })
    const { commissionReturnedCents, taxReturnedCents } = calculateRefundSplit(slice, totalCents)
    await prisma.orderStripeRefund.create({
      data: {
        orderId: order.id,
        stripeRefundId: refundKey,
        amountCents: totalCents,
        commissionReturnedCents,
        taxReturnedCents,
        reason: "dispute_lost",
      },
    })
  }

  // 3. Clawback ledger, only once every reversal is verified (otherwise REFUND_PENDING_CLAWBACK and the cron retries).
  let result: "refunded" | "pending_clawback" = "refunded"
  const safety = await evaluateClawbackSafety(order.id, { stripeRefundId: refundKey, requireFullRecovery: true })
  if (safety.allowed) {
    const clawback = await clawbackOrderPayoutsOnRefund(order.id, { skipSafetyCheck: true })
    if (!clawback.executed) {
      result = "pending_clawback"
      alertClawbackBlocked(order.id, clawback.skippedReason ?? "clawback_not_executed")
    }
  } else {
    await markRefundPendingClawback(order.id)
    result = "pending_clawback"
    alertClawbackBlocked(order.id, safety.reason)
  }

  // 4. Order state (the same words as a Stripe refund). A pending clawback keeps its status until the cron completes it.
  await tx.order.update({
    where: { id: order.id },
    data: {
      paymentSettlementStatus: result === "refunded" ? "REFUNDED" : "REFUND_PENDING_CLAWBACK",
      ...(result === "refunded" ? { status: "refunded" } : {}),
    },
  })

  // 5. Best-effort follow-ups of a full refund: stop an upstream purchase, give back sponsor fees. Neither ever throws.
  try {
    const { attemptExternalOrderCancellation } = await import("@/lib/fulfillment/external-order-cancellation")
    await attemptExternalOrderCancellation(order.id)
  } catch (error) {
    logStripeWebhookError({
      metric: "dispute_external_cancel_failed",
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
  try {
    const { reverseSponsorSuccessFeesForOrder } = await import("@/lib/sponsor/charge-sponsor-on-sale")
    await reverseSponsorSuccessFeesForOrder(order.id, { fraction: 1 })
  } catch (error) {
    logStripeWebhookError({
      metric: "dispute_sponsor_reversal_failed",
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return result
}

async function handleDisputeLost(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  orders: DisputeOrder[],
  tx: Tx
): Promise<DisputeEventOutcome> {
  const allocation = allocateDisputeLoss({
    disputeAmountCents: dispute.amount,
    disputeCurrency: dispute.currency,
    orders: orders.map((order) => ({
      id: order.id,
      chargedTotalCents: orderChargedTotalCents(order),
      currency: order.currency,
    })),
  })

  if (allocation.kind === "manual") {
    // Keep (or put) every open order on hold and call a human: no money moves on a guess.
    for (const order of orders) {
      if (isOrderClosedForPayout(order)) continue
      const hold = await openDisputeHold(tx, {
        disputeId: dispute.id,
        orderId: order.id,
        previousStatus: order.status.trim() || null,
      })
      if (hold === "already_closed") continue
      const nextStatus = statusWhenDisputeOpens(order)
      if (nextStatus) await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } })
    }
    await alertDispute(
      "error",
      `🚨 Stripe dispute ${dispute.id} LOST (${centsLabel(dispute.amount, dispute.currency)}) but it can not be applied ` +
        `automatically (${allocation.reason}) on order(s) ${orders.map((o) => o.id).join(", ") || "none found"}. ` +
        `Payouts stay HELD; settle it by hand (reverse the transfers, then mark the order refunded).`,
      { disputeId: dispute.id, reason: allocation.reason, eventId: event.id, orderIds: orders.map((o) => o.id) }
    )
    return { orderId: orders[0]?.id ?? null, status: "skipped", error: `dispute_lost_manual_review:${allocation.reason}` }
  }

  const applied: string[] = []
  const pendingClawback: string[] = []
  const doubleLoss: string[] = []

  for (const order of orders) {
    const hold = await readDisputeHold(tx, dispute.id, order.id)
    if (hold && hold.status !== DISPUTE_HOLD_STATUS.open) continue // terminal already: replay / duplicate

    if (isOrderClosedForPayout(order)) {
      // Refunded before the bank decided: the charge is lost AND the buyer was refunded. Nothing to claw back twice.
      doubleLoss.push(order.id)
    } else {
      const result = await applyFullDisputeLoss(dispute, order, tx)
      applied.push(order.id)
      if (result === "pending_clawback") pendingClawback.push(order.id)
    }
    // The terminal ledger row is written LAST, after every effect of this order.
    await closeDisputeHold(tx, { disputeId: dispute.id, orderId: order.id, outcome: "lost" })
  }

  if (applied.length > 0 || doubleLoss.length > 0) {
    await alertDispute(
      "error",
      `🚨 Stripe dispute ${dispute.id} LOST — ${centsLabel(allocation.totalCents, dispute.currency)} charged back. ` +
        (applied.length > 0
          ? `Order(s) ${applied.join(", ")}: payouts reversed / clawed back` +
            (pendingClawback.length > 0
              ? ` (clawback still pending for ${pendingClawback.join(", ")}: the retry-pending-clawback cron continues)`
              : "") +
            ". "
          : "") +
        (doubleLoss.length > 0
          ? `Order(s) ${doubleLoss.join(", ")} were already refunded: the platform lost the money twice, check Stripe. `
          : "") +
        `Stripe's dispute fee is not allocated to anyone.`,
      { disputeId: dispute.id, applied, pendingClawback, doubleLoss, eventId: event.id }
    )
  }

  return { orderId: orders[0]?.id ?? null, status: "success", error: null }
}

/** Entry point for `charge.dispute.*` (called by the webhook processor inside its transaction). */
export async function processStripeDisputeEvent(event: Stripe.Event, tx: Tx): Promise<DisputeEventOutcome> {
  const dispute = event.data.object as Stripe.Dispute
  const disputeId = typeof dispute?.id === "string" ? dispute.id.trim() : ""
  if (!disputeId) {
    logStripeWebhookError({ metric: "stripe_dispute_missing_id", eventId: event.id, type: event.type })
    return { orderId: null, status: "skipped", error: "dispute_missing_id" }
  }

  const outcome: DisputeOutcome = disputeOutcomeFromStripeStatus(dispute.status)
  logStripeWebhookInfo({
    metric: "stripe_dispute_event",
    eventId: event.id,
    type: event.type,
    disputeId,
    status: dispute.status,
    outcome,
    amount: dispute.amount,
    reason: dispute.reason,
  })

  const orderIds = await findOrderIdsForDispute(dispute)
  if (orderIds.length === 0) {
    // Not a marketplace order (Pro / Radar subscription, blind dropship, sponsor credit…) or not linked yet: money is at
    // risk and nothing here can act on it — a human must. Told once (not on every `updated`).
    if (event.type !== "charge.dispute.updated") {
      await alertDispute(
        "error",
        `🚨 Stripe dispute ${dispute.id} (${centsLabel(dispute.amount, dispute.currency)}, ${dispute.status}) on charge ` +
          `${stripeObjectId(dispute.charge) ?? "?"} matches NO marketplace order. Handle it in the Stripe dashboard.`,
        { disputeId, eventId: event.id, status: dispute.status }
      )
    }
    return { orderId: null, status: "skipped", error: "orders_not_found" }
  }

  const orders = await tx.order.findMany({ where: { id: { in: orderIds } }, select: ORDER_SELECT })

  switch (outcome) {
    case "open":
      return handleDisputeOpen(event, dispute, orders, tx)
    case "won":
    case "closed":
      return handleDisputeReleased(event, dispute, outcome, orders, tx)
    case "lost":
      return handleDisputeLost(event, dispute, orders, tx)
  }
}
