import type { TransferRole } from "@prisma/client"
import type Stripe from "stripe"

import {
  incrementTransferAttemptReversedCents,
  mapOutcomeToReversalStatus,
  persistTransferReversal,
  reversalIdempotencyKey,
} from "@/lib/payout-reversal-safety"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import {
  computeIncrementalReversalCents,
  proportionalRefundShareCents,
} from "@/lib/transfer-reversal-amounts"

export type TransferReversalOutcome = {
  orderId: string
  role: TransferRole | "LIGHTNING"
  transferId: string
  attemptId: string | null
  amountCents: number
  transferCents: number
  reversedSoFar: number
  availableCents: number
  status: "reversed" | "skipped" | "warning"
  reason?: string
  reversalId?: string
  persistedStatus?: "SUCCESS" | "FAILED" | "PARTIAL"
}

export type ReverseConnectTransfersResult = {
  outcomes: TransferReversalOutcome[]
  attemptedReversalCount: number
}

function isAlreadyReversedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes("already been reversed") ||
    msg.includes("already reversed") ||
    msg.includes("transfer_reversal_amount_exceeds")
  )
}

export type ResolveTransferRowsInput = {
  transferAttempts: Array<{
    id?: string
    role: TransferRole
    status: string
    stripeTransferId: string | null
    amountCents: number
    reversedAmountCents?: number
  }>
  payoutTransferIds: unknown
  reversalTotalsByTransferId?: Map<string, number>
}

export type ReversibleTransferRow = {
  role: TransferRole | "LIGHTNING"
  transferId: string
  attemptId: string | null
  amountCents: number
  reversedAmountCents: number
}

/** Collect SUCCESS Connect / Lightning transfer ids for reversal. */
export function resolveReversibleTransfers(input: ResolveTransferRowsInput): ReversibleTransferRow[] {
  const out: ReversibleTransferRow[] = []
  const totals = input.reversalTotalsByTransferId

  for (const attempt of input.transferAttempts) {
    if (attempt.status !== "SUCCESS") continue
    const id = attempt.stripeTransferId?.trim()
    if (!id || attempt.amountCents < 1) continue
    const reversedFromAttempt = attempt.reversedAmountCents ?? totals?.get(id) ?? 0
    out.push({
      role: attempt.role,
      transferId: id,
      attemptId: attempt.id ?? null,
      amountCents: attempt.amountCents,
      reversedAmountCents: reversedFromAttempt,
    })
  }

  if (out.length > 0) return out

  if (!Array.isArray(input.payoutTransferIds)) return out
  for (const raw of input.payoutTransferIds) {
    if (typeof raw !== "string" || !raw.trim()) continue
    const id = raw.trim()
    out.push({
      role: "LIGHTNING",
      transferId: id,
      attemptId: null,
      amountCents: 0,
      reversedAmountCents: totals?.get(id) ?? 0,
    })
  }
  return out
}

async function persistOutcome(args: {
  orderId: string
  stripeRefundId: string
  role: TransferRole | "LIGHTNING"
  transferId: string
  attemptId: string | null
  originalCents: number
  reversedSoFar: number
  reverseCents: number
  outcome: TransferReversalOutcome
}): Promise<TransferReversalOutcome> {
  const persistedStatus = mapOutcomeToReversalStatus({
    runtimeStatus: args.outcome.status,
    reverseCents: args.reverseCents,
    originalCents: args.originalCents,
    reversedSoFar: args.reversedSoFar,
    reason: args.outcome.reason,
  })

  if (!persistedStatus) return args.outcome

  const idempotencyKey = reversalIdempotencyKey(
    args.orderId,
    args.transferId,
    args.stripeRefundId
  )

  const { status, created } = await persistTransferReversal({
    orderId: args.orderId,
    stripeRefundId: args.stripeRefundId,
    stripeTransferId: args.transferId,
    stripeReversalId: args.outcome.reversalId ?? null,
    role: args.role,
    requestedCents: args.reverseCents,
    amountCents: args.reverseCents,
    status: persistedStatus,
    errorMessage: args.outcome.reason ?? null,
    idempotencyKey,
  })

  if (
    created &&
    args.attemptId &&
    args.outcome.status === "reversed" &&
    args.reverseCents > 0
  ) {
    await incrementTransferAttemptReversedCents({
      attemptId: args.attemptId,
      reverseCents: args.reverseCents,
    })
  }

  return { ...args.outcome, persistedStatus: status }
}

export async function reverseConnectTransfersForRefund(args: {
  orderId: string
  stripeRefundId: string
  refundAmountCents: number
  orderTotalCents: number
  isFullRefund: boolean
  refundKey: string
}): Promise<ReverseConnectTransfersResult> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
      payoutTransferIds: true,
      transferAttempts: {
        where: { status: "SUCCESS" },
        select: {
          id: true,
          role: true,
          status: true,
          stripeTransferId: true,
          amountCents: true,
          reversedAmountCents: true,
        },
      },
    },
  })
  if (!order) return { outcomes: [], attemptedReversalCount: 0 }

  const reversalTotals = await prisma.transferReversal.groupBy({
    by: ["stripeTransferId"],
    where: {
      orderId: args.orderId,
      status: { in: ["SUCCESS", "PARTIAL"] },
    },
    _sum: { amountCents: true },
  })
  const reversalTotalsByTransferId = new Map(
    reversalTotals.map((row) => [row.stripeTransferId, row._sum.amountCents ?? 0])
  )

  const transfers = resolveReversibleTransfers({
    transferAttempts: order.transferAttempts,
    payoutTransferIds: order.payoutTransferIds,
    reversalTotalsByTransferId,
  })
  if (transfers.length === 0) {
    console.log("[stripe-reversal]", { orderId: args.orderId, result: "no_transfers" })
    return { outcomes: [], attemptedReversalCount: 0 }
  }

  const stripe = getStripeClient()
  const outcomes: TransferReversalOutcome[] = []
  const orderTotal = Math.max(1, Math.round(args.orderTotalCents))
  let attemptedReversalCount = 0

  for (const row of transfers) {
    let originalCents = row.amountCents
    if (originalCents < 1) {
      originalCents =
        row.role === "SUPPLIER"
          ? order.supplierPayoutCents
          : row.role === "AFFILIATE"
            ? order.affiliatePayoutCents
            : 0
    }

    const reversedSoFar = Math.max(row.reversedAmountCents, reversalTotalsByTransferId.get(row.transferId) ?? 0)

    if (originalCents < 1) {
      const outcome: TransferReversalOutcome = {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        attemptId: row.attemptId,
        amountCents: 0,
        transferCents: 0,
        reversedSoFar,
        availableCents: 0,
        status: "skipped",
        reason: "unknown_transfer_amount",
      }
      attemptedReversalCount += 1
      outcomes.push(
        await persistOutcome({
          orderId: args.orderId,
          stripeRefundId: args.stripeRefundId,
          role: row.role,
          transferId: row.transferId,
          attemptId: row.attemptId,
          originalCents: 0,
          reversedSoFar,
          reverseCents: 0,
          outcome,
        })
      )
      continue
    }

    const plan = computeIncrementalReversalCents({
      originalCents,
      reversedSoFar,
      refundAmountCents: args.refundAmountCents,
      orderTotalCents: orderTotal,
      isFullRefund: args.isFullRefund,
    })

    if (plan.skipReason) {
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        attemptId: row.attemptId,
        amountCents: 0,
        transferCents: originalCents,
        reversedSoFar,
        availableCents: plan.availableCents,
        status: "skipped",
        reason: plan.skipReason,
      })
      continue
    }

    const reverseCents = plan.reverseCents
    attemptedReversalCount += 1

    try {
      const reversal = await stripe.transfers.createReversal(
        row.transferId,
        { amount: reverseCents },
        { idempotencyKey: reversalIdempotencyKey(args.orderId, row.transferId, args.refundKey) }
      )
      const outcome: TransferReversalOutcome = {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        attemptId: row.attemptId,
        amountCents: reverseCents,
        transferCents: originalCents,
        reversedSoFar,
        availableCents: plan.availableCents,
        status: "reversed",
        reversalId: reversal.id,
      }
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: reverseCents,
        reversedSoFar,
        availableCents: plan.availableCents,
        reversalId: reversal.id,
        result: "reversed",
      })
      outcomes.push(
        await persistOutcome({
          orderId: args.orderId,
          stripeRefundId: args.stripeRefundId,
          role: row.role,
          transferId: row.transferId,
          attemptId: row.attemptId,
          originalCents,
          reversedSoFar,
          reverseCents,
          outcome,
        })
      )
    } catch (error) {
      const reason = isAlreadyReversedError(error)
        ? "already_reversed"
        : error instanceof Error
          ? error.message
          : String(error)
      const outcome: TransferReversalOutcome = {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        attemptId: row.attemptId,
        amountCents: reverseCents,
        transferCents: originalCents,
        reversedSoFar,
        availableCents: plan.availableCents,
        status: "warning",
        reason,
      }
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        transferId: row.transferId,
        reversedSoFar,
        availableCents: plan.availableCents,
        result: isAlreadyReversedError(error) ? "already_reversed" : "error",
        reason,
      })
      outcomes.push(
        await persistOutcome({
          orderId: args.orderId,
          stripeRefundId: args.stripeRefundId,
          role: row.role,
          transferId: row.transferId,
          attemptId: row.attemptId,
          originalCents,
          reversedSoFar,
          reverseCents,
          outcome,
        })
      )
    }
  }

  return { outcomes, attemptedReversalCount }
}

export {
  isAlreadyReversedError,
  reversalIdempotencyKey,
  proportionalRefundShareCents as proportionalCents,
}
