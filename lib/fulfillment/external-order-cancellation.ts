import "server-only"

import * as Sentry from "@sentry/nextjs"

import { cancelAliExpressDsOrder } from "@/lib/aliexpress-ds-cancel-order"
import { resolveSupplierAdapterForGroup } from "@/lib/suppliers/place-order-bridge"
import { prisma } from "@/lib/prisma"

/**
 * Money-loss guard for refunds: when a customer's payment is refunded/reversed after the
 * upstream (AliExpress/CJ/…) purchase already happened, this attempts to cancel that upstream
 * order so Affisell isn't left holding wholesale cost it can never recover.
 *
 * Two fulfillment paths exist in this codebase and are checked in order:
 *  1. Legacy AE auto-buy (`FulfillmentLog` — see lib/fulfillment/auto-buy.ts), the path real
 *     auto-buy spend actually flows through today. Calls AliExpress's own
 *     `aliexpress.ds.order.afterpay` (see lib/aliexpress-ds-cancel-order.ts) — the only
 *     order-cancellation method AliExpress's Open Platform exposes to a dropshipper. A
 *     successful call is recorded as REQUESTED, not CANCELLED, because AliExpress doesn't
 *     document whether that's instant or still needs seller approval; a failed/unconfigured
 *     call falls back to MANUAL_REQUIRED.
 *  2. The generic multi-provider engine (`SupplierFulfillmentOrder` — see lib/auto-order/).
 *     Only channels with a verified, unambiguous cancel implementation (CJ Dropshipping,
 *     blind-REST partners) are attempted automatically here; every other channel type is
 *     conservatively treated as MANUAL_REQUIRED, because several adapters (manual, stub)
 *     resolve `cancelOrder()` successfully without doing anything, and this guard must never
 *     mistake that silence for a real cancellation.
 */

const AUTO_CANCEL_TRUSTED_CHANNELS = new Set(["CJ_DROPSHIPPING", "BLIND_REST"])

export type ExternalCancelOutcome =
  | { outcome: "not_applicable" }
  | { outcome: "already_handled"; status: string }
  | { outcome: "cancelled" }
  | { outcome: "requested"; note: string }
  | { outcome: "manual_required"; reason: string; channel: string }
  | { outcome: "failed"; error: string; channel: string }

function alertManualCancelRequired(args: {
  orderId: string
  channel: string
  externalOrderId: string | null
  reason: string
}) {
  console.error("[external-order-cancellation]", {
    orderId: args.orderId,
    channel: args.channel,
    externalOrderId: args.externalOrderId,
    reason: args.reason,
    result: "manual_cancel_required",
  })
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.captureMessage("Upstream order needs manual cancellation after refund", {
      level: "error",
      extra: args,
    })
  }
}

async function attemptViaLegacyAutoBuy(orderId: string): Promise<ExternalCancelOutcome | null> {
  const log = await prisma.fulfillmentLog.findUnique({ where: { orderId } })
  if (!log) return null
  if (log.status !== "BOUGHT") return { outcome: "not_applicable" }
  if (log.externalCancelStatus !== "NOT_ATTEMPTED") {
    return { outcome: "already_handled", status: log.externalCancelStatus }
  }

  if (!log.aeOrderId) {
    const reason = "missing_ae_order_id"
    await prisma.fulfillmentLog.update({
      where: { orderId },
      data: {
        externalCancelStatus: "MANUAL_REQUIRED",
        externalCancelAttemptedAt: new Date(),
        externalCancelNote: "Order is marked BOUGHT but has no aeOrderId on file — check manually.",
      },
    })
    alertManualCancelRequired({ orderId, channel: "ALIEXPRESS", externalOrderId: null, reason })
    return { outcome: "manual_required", reason, channel: "ALIEXPRESS" }
  }

  const result = await cancelAliExpressDsOrder(log.aeOrderId)

  if (result.ok && result.requested) {
    const note = `Cancellation requested via aliexpress.ds.order.afterpay — AliExpress does not document whether this is instant or still needs seller approval. Order status after request: ${result.orderStatusAfter ?? "unknown"}. Verify manually if in doubt.`
    await prisma.fulfillmentLog.update({
      where: { orderId },
      data: { externalCancelStatus: "REQUESTED", externalCancelAttemptedAt: new Date(), externalCancelNote: note },
    })
    console.log("[external-order-cancellation]", {
      orderId,
      channel: "ALIEXPRESS",
      externalOrderId: log.aeOrderId,
      orderStatusAfter: result.orderStatusAfter,
      result: "requested",
    })
    return { outcome: "requested", note }
  }

  const reason = result.ok ? "aliexpress_afterpay_declined" : result.error
  const note = result.ok
    ? `aliexpress.ds.order.afterpay call succeeded but did not accept the cancellation request (order status after: ${result.orderStatusAfter ?? "unknown"}) — cancel manually via AliExpress after-sales/dispute.`
    : `aliexpress.ds.order.afterpay call failed (${result.error}) — cancel manually via AliExpress after-sales/dispute.`
  await prisma.fulfillmentLog.update({
    where: { orderId },
    data: { externalCancelStatus: "MANUAL_REQUIRED", externalCancelAttemptedAt: new Date(), externalCancelNote: note },
  })
  alertManualCancelRequired({ orderId, channel: "ALIEXPRESS", externalOrderId: log.aeOrderId, reason })
  return { outcome: "manual_required", reason, channel: "ALIEXPRESS" }
}

async function attemptViaGenericEngine(orderId: string): Promise<ExternalCancelOutcome> {
  const line = await prisma.supplierFulfillmentOrderLine.findFirst({
    where: { orderId },
    include: { supplierFulfillmentOrder: { include: { provider: true } } },
  })
  const job = line?.supplierFulfillmentOrder
  if (!job || !job.supplierOrderId) {
    return { outcome: "not_applicable" }
  }
  if (job.externalCancelStatus !== "NOT_ATTEMPTED") {
    return { outcome: "already_handled", status: job.externalCancelStatus }
  }

  const channel = job.provider.channelType

  if (job.status === "SHIPPED" || job.status === "DELIVERED" || job.status === "CANCELLED") {
    const reason = "already_shipped_or_terminal"
    await prisma.supplierFulfillmentOrder.update({
      where: { id: job.id },
      data: { externalCancelStatus: "MANUAL_REQUIRED", externalCancelAttemptedAt: new Date(), externalCancelNote: reason },
    })
    alertManualCancelRequired({ orderId, channel, externalOrderId: job.supplierOrderId, reason })
    return { outcome: "manual_required", reason, channel }
  }

  if (!AUTO_CANCEL_TRUSTED_CHANNELS.has(channel)) {
    const reason = "channel_cancel_not_verified"
    await prisma.supplierFulfillmentOrder.update({
      where: { id: job.id },
      data: { externalCancelStatus: "MANUAL_REQUIRED", externalCancelAttemptedAt: new Date(), externalCancelNote: reason },
    })
    alertManualCancelRequired({ orderId, channel, externalOrderId: job.supplierOrderId, reason })
    return { outcome: "manual_required", reason, channel }
  }

  try {
    const adapter = await resolveSupplierAdapterForGroup(job.fulfillmentProviderId)
    await adapter.cancelOrder(job.supplierOrderId)
    await prisma.supplierFulfillmentOrder.update({
      where: { id: job.id },
      data: {
        status: "CANCELLED",
        externalCancelStatus: "CANCELLED",
        externalCancelAttemptedAt: new Date(),
        errorMessage: "cancelled_on_refund",
      },
    })
    console.log("[external-order-cancellation]", {
      orderId,
      channel,
      externalOrderId: job.supplierOrderId,
      result: "cancelled",
    })
    return { outcome: "cancelled" }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await prisma.supplierFulfillmentOrder.update({
      where: { id: job.id },
      data: { externalCancelStatus: "FAILED", externalCancelAttemptedAt: new Date(), externalCancelNote: error },
    })
    alertManualCancelRequired({ orderId, channel, externalOrderId: job.supplierOrderId, reason: error })
    return { outcome: "failed", error, channel }
  }
}

/**
 * Idempotent — safe to call more than once for the same order (e.g. a partial refund
 * followed by a full refund). Never throws: callers must not let this block the customer's
 * Stripe refund, which is the more urgent obligation.
 */
export async function attemptExternalOrderCancellation(orderId: string): Promise<ExternalCancelOutcome> {
  try {
    const legacy = await attemptViaLegacyAutoBuy(orderId)
    if (legacy && legacy.outcome !== "not_applicable") return legacy
    return await attemptViaGenericEngine(orderId)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error("[external-order-cancellation]", { orderId, error, result: "attempt_threw" })
    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureException(e instanceof Error ? e : new Error(error), { extra: { orderId } })
    }
    return { outcome: "failed", error, channel: "unknown" }
  }
}
