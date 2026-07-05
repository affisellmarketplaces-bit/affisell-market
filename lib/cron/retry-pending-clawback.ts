import { clawbackOrderPayoutsOnRefund } from "@/lib/order-payout"
import { evaluateClawbackSafety } from "@/lib/payout-reversal-safety"
import { prisma } from "@/lib/prisma"

export type RetryPendingClawbackResult = {
  scanned: number
  retried: number
  succeeded: number
  stillPending: number
}

/**
 * Re-evaluate REFUND_PENDING_CLAWBACK orders after Stripe reversals recover.
 * Idempotent — safe on cron replay.
 */
export async function retryPendingClawbacks(limit = 50): Promise<RetryPendingClawbackResult> {
  const orders = await prisma.order.findMany({
    where: { paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let retried = 0
  let succeeded = 0
  let stillPending = 0

  for (const { id: orderId } of orders) {
    const safety = await evaluateClawbackSafety(orderId, { requireFullRecovery: true })
    if (!safety.allowed) {
      stillPending += 1
      console.log("[retry-pending-clawback]", {
        orderId,
        reason: safety.reason,
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
    retried,
    succeeded,
    stillPending,
    result: "batch_complete",
  })

  return { scanned: orders.length, retried, succeeded, stillPending }
}
