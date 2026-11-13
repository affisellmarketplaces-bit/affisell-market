import type { Prisma } from "@prisma/client"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { evaluateShipPulseAutoCancel } from "@/lib/orders/ship-pulse-policy"
import { prisma } from "@/lib/prisma"
import { initiateMarketplaceRefundPipeline } from "@/lib/marketplace-refund-pipeline"
import { resolveShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"

export type AutoCancelShipSlaResult = {
  ok: boolean
  orderId: string
  refunded?: boolean
  emailSent?: boolean
  error?: string
  skipped?: string
  cancelReason?: string
}

export async function autoCancelMarketplaceOrderShipSlaBreach(
  orderId: string
): Promise<AutoCancelShipSlaResult> {
  const now = new Date()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      supplierId: true,
      affiliateId: true,
      autoCancelledAt: true,
      cancelledEmailSentAt: true,
      shipDeadlineAt: true,
      paidAt: true,
      createdAt: true,
      trackingNumber: true,
      product: { select: { name: true } },
      supplierFulfillmentLinks: {
        select: { supplierFulfillmentOrderId: true },
      },
      shipExtensions: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          buyerExpiresAt: true,
          newDeadlineAt: true,
          createdAt: true,
        },
      },
      fulfillmentMessages: {
        where: { authorRole: "SUPPLIER" },
        select: { id: true },
      },
    },
  })

  if (!order) return { ok: false, orderId, error: "order_not_found" }
  if (order.autoCancelledAt || order.cancelledEmailSentAt) {
    return { ok: false, orderId, skipped: "already_cancelled" }
  }
  if (!["paid", "preparing"].includes(order.status)) {
    return { ok: false, orderId, skipped: "not_awaiting_shipment" }
  }

  const deadline = resolveShipDeadlineAt(order)
  const decision = evaluateShipPulseAutoCancel({
    now,
    deadline,
    trackingNumber: order.trackingNumber,
    supplierMessageCount: order.fulfillmentMessages.length,
    extensions: order.shipExtensions,
  })

  if (!decision.eligible) {
    return { ok: false, orderId, skipped: decision.reason }
  }

  const claim = await prisma.order.updateMany({
    where: {
      id: orderId,
      autoCancelledAt: null,
      status: { in: ["paid", "preparing"] },
    },
    data: {
      autoCancelledAt: now,
      shipDeadlineAt: order.shipDeadlineAt ?? deadline,
    },
  })
  if (claim.count === 0) {
    return { ok: false, orderId, skipped: "claim_failed" }
  }

  const jobIds = [
    ...new Set(order.supplierFulfillmentLinks.map((l) => l.supplierFulfillmentOrderId)),
  ]
  for (const jobId of jobIds) {
    const result = await cancelSupplierFulfillmentJob(jobId, { forOrderId: orderId })
    if (!result.ok && result.error !== "not_cancellable" && result.error !== "missing_supplier_order_id") {
      console.error("[ship_pulse] supplier_job_cancel", { orderId, jobId, error: result.error })
    }
  }

  const refund = await initiateMarketplaceRefundPipeline({
    orderId,
    source: "ship_sla_auto_cancel",
  })
  // `already_refunded` = the money already went back (webhook lag): nothing left to do on the refund side.
  const refundDone = refund.ok || refund.skipped === "already_refunded"

  if (!refundDone) {
    // D5: the order is NEVER marked `refunded` here and the buyer is not told a refund is on its way. The refund itself
    // raised the ops alert / Sentry event. What stays is a trace on the order and a state a later run can pick up.
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: "FAILED",
        fulfillmentErrors: [
          {
            source: "ship_sla_auto_cancel",
            policyReason: decision.reason,
            deadlineAt: deadline.toISOString(),
            refunded: false,
            stripeRefundId: null,
            refundError: refund.error ?? "refund_failed",
            retryable: refund.retryable ?? false,
          },
        ] as Prisma.InputJsonValue,
      },
    })
    if (refund.retryable) {
      // Release the claim: the cron selects `autoCancelledAt: null`, so the next run retries the refund (stable
      // idempotency key, so a refund that actually went through is not duplicated). Supplier / affiliate
      // notifications go out with the successful run, not once per attempt.
      await prisma.order.updateMany({
        where: { id: orderId, autoCancelledAt: now },
        data: { autoCancelledAt: null },
      })
    }
    return {
      ok: false,
      orderId,
      refunded: false,
      error: refund.error ?? "refund_failed",
      cancelReason: decision.reason,
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: "FAILED",
      fulfillmentErrors: [
        {
          source: "ship_sla_auto_cancel",
          policyReason: decision.reason,
          deadlineAt: deadline.toISOString(),
          refunded: true,
          stripeRefundId: refund.stripeRefundId ?? null,
          refundError: null,
        },
      ] as Prisma.InputJsonValue,
    },
  })

  const productName = order.product?.name ?? "Order"
  const supplierMsg = `Ship Pulse · ${productName} — auto-cancelled (${decision.reason}). Buyer refund ${refund.ok ? "initiated" : "already issued"}.`

  await prisma.notification.createMany({
    data: [
      {
        userId: order.supplierId,
        type: "SHIP_SLA_AUTO_CANCEL",
        message: supplierMsg,
        orderId,
      },
      {
        userId: order.affiliateId,
        type: "SHIP_SLA_AUTO_CANCEL",
        message: `Ship Pulse · ${productName} — order cancelled after ship deadline / extension refused.`,
        orderId,
      },
    ],
  })

  await prisma.notification.updateMany({
    where: { userId: order.supplierId, orderId, type: "NEW_ORDER", read: false },
    data: { read: true },
  })

  // The buyer's cancellation e-mail and the `refunded` status come from the `charge.refunded` webhook once Stripe
  // confirms the refund (`handleStripeChargeRefundedWithCommission`) — never from here.
  console.log("[ship_pulse] refund_initiated", {
    orderId,
    stripeRefundId: refund.stripeRefundId ?? null,
    metric: "ship_sla_auto_cancel_refund",
    policyReason: decision.reason,
  })

  return {
    ok: true,
    orderId,
    refunded: true,
    cancelReason: decision.reason,
  }
}
