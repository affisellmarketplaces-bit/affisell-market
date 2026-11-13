import type { Prisma } from "@prisma/client"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { initiateMarketplaceRefundPipeline } from "@/lib/marketplace-refund-pipeline"
import { evaluateRefundEligibility } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"

export type CancelMarketplaceOrderResult = {
  ok: boolean
  error?: string
  emailSent?: boolean
  stripeRefundId?: string
  /** The buyer had paid and the Stripe refund did not happen: the order is NOT marked refunded and the cancel can be replayed. */
  refundFailed?: boolean
  retryable?: boolean
}

/**
 * Admin cancellation of a marketplace order line.
 *
 * `status: "refunded"` is written ONLY once Stripe accepted a refund (finalisation master doc, D5) — it used to be written
 * by the confirmation e-mail whether or not any money moved:
 *  - paid order  → supplier jobs cancelled, then a real Stripe refund (`admin_refund`); on success the order is marked
 *    refunded and the buyer is told; on failure the order keeps its status, an ops alert is raised and the same call can
 *    simply be repeated (the supplier-job cancellation tolerates "already cancelled", the refund has a stable
 *    idempotency key);
 *  - never-paid order → nothing to refund: it becomes `cancelled`, not `refunded`.
 */
export async function cancelMarketplaceOrderByAdmin(
  orderId: string,
  cancelReason?: string
): Promise<CancelMarketplaceOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      stripeChargeId: true,
      paymentSettlementStatus: true,
      supplierFulfillmentLinks: {
        select: { supplierFulfillmentOrderId: true },
      },
    },
  })
  if (!order) return { ok: false, error: "order_not_found" }

  const eligibility = evaluateRefundEligibility(order)
  if (!eligibility.ok && eligibility.reason === "already_refunded") {
    return { ok: false, error: "already_refunded" }
  }
  const mustRefund = eligibility.ok

  const jobIds = [
    ...new Set(order.supplierFulfillmentLinks.map((l) => l.supplierFulfillmentOrderId)),
  ]

  for (const jobId of jobIds) {
    const result = await cancelSupplierFulfillmentJob(jobId, { forOrderId: orderId })
    if (!result.ok && result.error !== "not_cancellable") {
      return { ok: false, error: result.error }
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: "MANUAL_REQUIRED",
      fulfillmentErrors: [{ source: "admin_cancel", reason: cancelReason ?? null }] as Prisma.InputJsonValue,
      ...(mustRefund ? {} : { status: "cancelled" }),
    },
  })

  const reasonForBuyer = cancelReason ?? "Annulation par l'équipe Affisell"

  if (!mustRefund) {
    const email = await notifyOrderCancelled(orderId, { cancelReason: reasonForBuyer })
    return { ok: true, emailSent: email.sent }
  }

  const refund = await initiateMarketplaceRefundPipeline({
    orderId,
    source: "admin_refund",
    reason: "requested_by_customer",
    metadata: { admin_cancel: "1" },
  })
  const alreadyRefunded = !refund.ok && refund.skipped === "already_refunded"

  if (!refund.ok && !alreadyRefunded) {
    // The alert was raised by the refund itself. Leave a trace on the order; status stays as it was (replayable).
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentErrors: [
          {
            source: "admin_cancel",
            reason: cancelReason ?? null,
            refunded: false,
            refundError: refund.error ?? "refund_failed",
            retryable: refund.retryable ?? false,
          },
        ] as Prisma.InputJsonValue,
      },
    })
    return {
      ok: false,
      error: refund.error ?? "refund_failed",
      refundFailed: true,
      retryable: refund.retryable ?? false,
    }
  }

  const email = await notifyOrderCancelled(orderId, {
    cancelReason: reasonForBuyer,
    // `already_refunded` carries no refund id: the status is then already `refunded` / REFUNDED.
    stripeRefundId: refund.stripeRefundId,
  })

  return { ok: true, emailSent: email.sent, stripeRefundId: refund.stripeRefundId }
}
