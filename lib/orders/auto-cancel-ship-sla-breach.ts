import type { Prisma } from "@prisma/client"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { evaluateShipPulseAutoCancel } from "@/lib/orders/ship-pulse-policy"
import { prisma } from "@/lib/prisma"
import { initiateMarketplaceRefundPipeline } from "@/lib/marketplace-refund-pipeline"
import { resolveShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"

const BUYER_CANCEL_REASON =
  "Shipping deadline passed — the seller did not ship in time. Your refund is on its way."

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
    const result = await cancelSupplierFulfillmentJob(jobId)
    if (!result.ok && result.error !== "not_cancellable" && result.error !== "missing_supplier_order_id") {
      console.error("[ship_pulse] supplier_job_cancel", { orderId, jobId, error: result.error })
    }
  }

  const refund = await initiateMarketplaceRefundPipeline({
    orderId,
    source: "ship_sla_auto_cancel",
  })

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: "FAILED",
      fulfillmentErrors: [
        {
          source: "ship_sla_auto_cancel",
          policyReason: decision.reason,
          deadlineAt: deadline.toISOString(),
          refunded: refund.ok,
          stripeRefundId: refund.stripeRefundId ?? null,
          refundError: refund.error ?? null,
        },
      ] as Prisma.InputJsonValue,
    },
  })

  const productName = order.product?.name ?? "Order"
  const supplierMsg = `Ship Pulse · ${productName} — auto-cancelled (${decision.reason}). Buyer refund ${refund.ok ? "initiated" : "pending"}.`

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

  let emailSent = false
  if (refund.ok) {
    console.log("[ship_pulse] refund_initiated", {
      orderId,
      stripeRefundId: refund.stripeRefundId,
      metric: "ship_sla_auto_cancel_refund",
      policyReason: decision.reason,
    })
  } else {
    const email = await notifyOrderCancelled(orderId, {
      cancelReason: BUYER_CANCEL_REASON,
      markRefunded: true,
    })
    emailSent = email.sent
  }

  return {
    ok: true,
    orderId,
    refunded: refund.ok,
    emailSent,
    error: refund.ok ? undefined : refund.error,
    cancelReason: decision.reason,
  }
}
