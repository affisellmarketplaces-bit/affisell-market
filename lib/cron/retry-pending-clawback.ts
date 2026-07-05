import { orderToCommissionRefundSlice } from "@/lib/commission"
import { clawbackOrderPayoutsOnRefund } from "@/lib/order-payout"
import { evaluateClawbackSafety } from "@/lib/payout-reversal-safety"
import { prisma } from "@/lib/prisma"
import { reverseConnectTransfersForRefund } from "@/lib/stripe-transfer-reversal"

export type RetryPendingClawbackResult = {
  scanned: number
  reversalRetried: number
  retried: number
  succeeded: number
  stillPending: number
}

type PendingRefundRow = {
  stripeRefundId: string
  amountCents: number
  isFullRefund: boolean
}

/** Re-run Connect reversals for each recorded Stripe refund (idempotent). */
export async function retryStripeReversalsForOrder(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      sellingPriceCents: true,
      platformCommissionCents: true,
      taxCents: true,
      stripeRefunds: {
        orderBy: { createdAt: "asc" },
        select: { stripeRefundId: true, amountCents: true },
      },
    },
  })
  if (!order || order.stripeRefunds.length === 0) return 0

  const slice = orderToCommissionRefundSlice(order)
  const orderTotalCents = slice.totalCents ?? order.sellingPriceCents

  let cumulativeRefunded = 0
  const refunds: PendingRefundRow[] = order.stripeRefunds.map((refund) => {
    cumulativeRefunded += refund.amountCents
    return {
      stripeRefundId: refund.stripeRefundId,
      amountCents: refund.amountCents,
      isFullRefund: cumulativeRefunded >= orderTotalCents - 1,
    }
  })

  let retried = 0
  for (const refund of refunds) {
    await reverseConnectTransfersForRefund({
      orderId: order.id,
      stripeRefundId: refund.stripeRefundId,
      refundAmountCents: refund.amountCents,
      orderTotalCents,
      isFullRefund: refund.isFullRefund,
      refundKey: refund.stripeRefundId,
    })
    retried += 1
    console.log("[retry-pending-clawback]", {
      orderId,
      stripeRefundId: refund.stripeRefundId,
      isFullRefund: refund.isFullRefund,
      result: "reversal_retried",
    })
  }

  return retried
}

/**
 * REFUND_PENDING_CLAWBACK worker: retry Stripe reversals → clawback ledger → REFUNDED.
 * Idempotent — safe on cron replay.
 */
export async function retryPendingClawbacks(limit = 50): Promise<RetryPendingClawbackResult> {
  const orders = await prisma.order.findMany({
    where: { paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let reversalRetried = 0
  let retried = 0
  let succeeded = 0
  let stillPending = 0

  for (const { id: orderId } of orders) {
    const reversalsAttempted = await retryStripeReversalsForOrder(orderId)
    reversalRetried += reversalsAttempted

    const safety = await evaluateClawbackSafety(orderId, { requireFullRecovery: true })
    if (!safety.allowed) {
      stillPending += 1
      console.log("[retry-pending-clawback]", {
        orderId,
        reason: safety.reason,
        reversalsAttempted,
        result: "still_pending",
      })
      continue
    }

    retried += 1
    const clawback = await clawbackOrderPayoutsOnRefund(orderId, { skipSafetyCheck: true })
    if (!clawback.executed) {
      stillPending += 1
      console.log("[retry-pending-clawback]", {
        orderId,
        skippedReason: clawback.skippedReason,
        result: "clawback_skipped",
      })
      continue
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentSettlementStatus: "REFUNDED",
        status: "refunded",
      },
    })

    succeeded += 1
    console.log("[retry-pending-clawback]", { orderId, result: "clawback_succeeded" })
  }

  console.log("[retry-pending-clawback]", {
    scanned: orders.length,
    reversalRetried,
    retried,
    succeeded,
    stillPending,
    result: "batch_complete",
  })

  return { scanned: orders.length, reversalRetried, retried, succeeded, stillPending }
}
