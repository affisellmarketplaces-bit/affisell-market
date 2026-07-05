import type { TransferRole } from "@prisma/client"
import type Stripe from "stripe"

import {
  mapOutcomeToReversalStatus,
  persistTransferReversal,
  reversalIdempotencyKey,
} from "@/lib/payout-reversal-safety"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export type TransferReversalOutcome = {
  orderId: string
  role: TransferRole | "LIGHTNING"
  transferId: string
  amountCents: number
  transferCents: number
  status: "reversed" | "skipped" | "warning"
  reason?: string
  reversalId?: string
  persistedStatus?: "SUCCESS" | "FAILED" | "PARTIAL"
}

export type ReverseConnectTransfersResult = {
  outcomes: TransferReversalOutcome[]
  attemptedReversalCount: number
}

function proportionalCents(transferCents: number, refundCents: number, orderTotalCents: number): number {
  if (orderTotalCents < 1) return 0
  const ratio = Math.min(1, Math.max(0, refundCents / orderTotalCents))
  return Math.max(0, Math.round(transferCents * ratio))
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
    role: TransferRole
    status: string
    stripeTransferId: string | null
    amountCents: number
  }>
  payoutTransferIds: unknown
}

/** Collect SUCCESS Connect / Lightning transfer ids for reversal. */
export function resolveReversibleTransfers(input: ResolveTransferRowsInput): Array<{
  role: TransferRole | "LIGHTNING"
  transferId: string
  amountCents: number
}> {
  const out: Array<{ role: TransferRole | "LIGHTNING"; transferId: string; amountCents: number }> = []

  for (const attempt of input.transferAttempts) {
    if (attempt.status !== "SUCCESS") continue
    const id = attempt.stripeTransferId?.trim()
    if (!id || attempt.amountCents < 1) continue
    out.push({ role: attempt.role, transferId: id, amountCents: attempt.amountCents })
  }

  if (out.length > 0) return out

  if (!Array.isArray(input.payoutTransferIds)) return out
  for (const raw of input.payoutTransferIds) {
    if (typeof raw !== "string" || !raw.trim()) continue
    out.push({ role: "LIGHTNING", transferId: raw.trim(), amountCents: 0 })
  }
  return out
}

async function persistOutcome(args: {
  orderId: string
  stripeRefundId: string
  role: TransferRole | "LIGHTNING"
  transferId: string
  transferCents: number
  requestedCents: number
  amountCents: number
  outcome: TransferReversalOutcome
}): Promise<TransferReversalOutcome> {
  const persistedStatus = mapOutcomeToReversalStatus({
    runtimeStatus: args.outcome.status,
    requestedCents: args.requestedCents,
    transferCents: args.transferCents,
    reason: args.outcome.reason,
  })

  if (!persistedStatus) return args.outcome

  const idempotencyKey = reversalIdempotencyKey(
    args.orderId,
    args.transferId,
    args.stripeRefundId
  )

  const status = await persistTransferReversal({
    orderId: args.orderId,
    stripeRefundId: args.stripeRefundId,
    stripeTransferId: args.transferId,
    stripeReversalId: args.outcome.reversalId ?? null,
    role: args.role,
    requestedCents: args.requestedCents,
    amountCents: args.amountCents,
    status: persistedStatus,
    errorMessage: args.outcome.reason ?? null,
    idempotencyKey,
  })

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
        select: { role: true, status: true, stripeTransferId: true, amountCents: true },
      },
    },
  })
  if (!order) return { outcomes: [], attemptedReversalCount: 0 }

  const transfers = resolveReversibleTransfers({
    transferAttempts: order.transferAttempts,
    payoutTransferIds: order.payoutTransferIds,
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
    let transferCents = row.amountCents
    if (transferCents < 1) {
      transferCents =
        row.role === "SUPPLIER"
          ? order.supplierPayoutCents
          : row.role === "AFFILIATE"
            ? order.affiliatePayoutCents
            : 0
    }
    if (transferCents < 1) {
      const outcome: TransferReversalOutcome = {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: 0,
        transferCents: 0,
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
          transferCents: 0,
          requestedCents: 0,
          amountCents: 0,
          outcome,
        })
      )
      continue
    }

    const reverseCents = args.isFullRefund
      ? transferCents
      : proportionalCents(transferCents, args.refundAmountCents, orderTotal)

    if (reverseCents < 1) {
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: 0,
        transferCents,
        status: "skipped",
        reason: "partial_below_cent",
      })
      continue
    }

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
        amountCents: reverseCents,
        transferCents,
        status: "reversed",
        reversalId: reversal.id,
      }
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: reverseCents,
        reversalId: reversal.id,
        result: "reversed",
      })
      outcomes.push(
        await persistOutcome({
          orderId: args.orderId,
          stripeRefundId: args.stripeRefundId,
          role: row.role,
          transferId: row.transferId,
          transferCents,
          requestedCents: reverseCents,
          amountCents: reverseCents,
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
        amountCents: reverseCents,
        transferCents,
        status: "warning",
        reason,
      }
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        transferId: row.transferId,
        result: isAlreadyReversedError(error) ? "already_reversed" : "error",
        reason,
      })
      outcomes.push(
        await persistOutcome({
          orderId: args.orderId,
          stripeRefundId: args.stripeRefundId,
          role: row.role,
          transferId: row.transferId,
          transferCents,
          requestedCents: reverseCents,
          amountCents: reverseCents,
          outcome,
        })
      )
    }
  }

  return { outcomes, attemptedReversalCount }
}

export { proportionalCents, isAlreadyReversedError, reversalIdempotencyKey }
