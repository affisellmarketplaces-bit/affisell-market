import type { TransferReversalStatus } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"

import { prisma } from "@/lib/prisma"
import { resolveReversibleTransfers } from "@/lib/stripe-transfer-reversal"
import { transferFullyReversed } from "@/lib/transfer-reversal-amounts"

export type ClawbackSafetyVerdict = {
  allowed: boolean
  reason: string
  pendingClawback: boolean
}

export type PersistReversalInput = {
  orderId: string
  stripeRefundId: string
  stripeTransferId: string
  stripeReversalId?: string | null
  role: string
  requestedCents: number
  amountCents: number
  status: TransferReversalStatus
  errorMessage?: string | null
  idempotencyKey: string
}

export function reversalIdempotencyKey(
  orderId: string,
  transferId: string,
  refundKey: string
): string {
  return `reversal_${orderId}_${transferId}_${refundKey}`
}

/** Map runtime outcome → persisted TransferReversalStatus. */
export function mapOutcomeToReversalStatus(args: {
  runtimeStatus: "reversed" | "skipped" | "warning"
  reverseCents: number
  originalCents: number
  reversedSoFar: number
  reason?: string
}): TransferReversalStatus | null {
  const { runtimeStatus, reverseCents, originalCents, reversedSoFar, reason } = args

  if (runtimeStatus === "skipped") {
    if (reason === "partial_below_cent" || reason === "fully_reversed") return null
    return "FAILED"
  }

  if (runtimeStatus === "reversed") {
    const after = reversedSoFar + reverseCents
    if (after >= originalCents) return "SUCCESS"
    return "PARTIAL"
  }

  if (reason === "already_reversed") return "SUCCESS"
  return "FAILED"
}

/** Idempotent persistence — safe on webhook replay. */
export async function persistTransferReversal(
  input: PersistReversalInput
): Promise<{ status: TransferReversalStatus; created: boolean }> {
  try {
    const row = await prisma.transferReversal.create({
      data: {
        orderId: input.orderId,
        stripeRefundId: input.stripeRefundId,
        stripeTransferId: input.stripeTransferId,
        stripeReversalId: input.stripeReversalId?.trim() || null,
        role: input.role,
        requestedCents: input.requestedCents,
        amountCents: input.amountCents,
        status: input.status,
        errorMessage: input.errorMessage?.trim() || null,
        idempotencyKey: input.idempotencyKey,
      },
      select: { status: true },
    })
    console.log("[payout-reversal-safety]", {
      orderId: input.orderId,
      stripeRefundId: input.stripeRefundId,
      stripeTransferId: input.stripeTransferId,
      status: row.status,
      result: "persisted",
    })
    return { status: row.status, created: true }
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === "P2002") {
      const existing = await prisma.transferReversal.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { status: true },
      })
      return { status: existing?.status ?? input.status, created: false }
    }
    throw error
  }
}

/** Increment cumulative reversal on TransferAttempt — capped at amountCents. */
export async function incrementTransferAttemptReversedCents(args: {
  attemptId: string
  reverseCents: number
}): Promise<number> {
  const reverseCents = Math.max(0, Math.round(args.reverseCents))
  if (reverseCents < 1) return 0

  const attempt = await prisma.transferAttempt.findUnique({
    where: { id: args.attemptId },
    select: { amountCents: true, reversedAmountCents: true },
  })
  if (!attempt) return 0

  const next = Math.min(attempt.amountCents, attempt.reversedAmountCents + reverseCents)
  if (next === attempt.reversedAmountCents) return next

  await prisma.transferAttempt.update({
    where: { id: args.attemptId },
    data: { reversedAmountCents: next },
  })

  console.log("[payout-reversal-safety]", {
    attemptId: args.attemptId,
    reversedAmountCents: next,
    amountCents: attempt.amountCents,
    result: "reversed_incremented",
  })

  return next
}

export function assessRefundReversalBatch(
  rows: Array<{ status: TransferReversalStatus }>,
  attemptedReversalCount: number,
  requireFullRecovery: boolean
): ClawbackSafetyVerdict {
  if (attemptedReversalCount === 0) {
    return { allowed: true, reason: "no_reversals_needed", pendingClawback: false }
  }

  if (rows.length < attemptedReversalCount) {
    return { allowed: false, reason: "reversal_incomplete", pendingClawback: true }
  }

  if (rows.some((row) => row.status === "FAILED")) {
    return { allowed: false, reason: "reversal_failed", pendingClawback: true }
  }

  if (requireFullRecovery && rows.some((row) => row.status === "PARTIAL")) {
    return { allowed: false, reason: "reversal_partial_only", pendingClawback: true }
  }

  if (rows.some((row) => row.status !== "SUCCESS" && row.status !== "PARTIAL")) {
    return { allowed: false, reason: "reversal_unknown", pendingClawback: true }
  }

  return { allowed: true, reason: "reversals_verified", pendingClawback: false }
}

/** Verify persisted reversals cover all Connect transfers before ledger clawback. */
export async function evaluateClawbackSafety(
  orderId: string,
  options?: { stripeRefundId?: string; requireFullRecovery?: boolean }
): Promise<ClawbackSafetyVerdict> {
  const requireFullRecovery = options?.requireFullRecovery ?? true

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      transferAttempts: {
        where: { status: "SUCCESS" },
        select: {
          role: true,
          status: true,
          stripeTransferId: true,
          amountCents: true,
          reversedAmountCents: true,
        },
      },
      payoutTransferIds: true,
    },
  })
  if (!order) {
    return { allowed: false, reason: "order_not_found", pendingClawback: true }
  }

  const reversible = resolveReversibleTransfers({
    transferAttempts: order.transferAttempts,
    payoutTransferIds: order.payoutTransferIds,
  })

  if (reversible.length === 0) {
    return { allowed: true, reason: "no_stripe_transfers", pendingClawback: false }
  }

  const settledAttempts = order.transferAttempts.filter(
    (attempt) => attempt.stripeTransferId?.trim() && attempt.amountCents > 0
  )

  if (
    requireFullRecovery &&
    settledAttempts.some(
      (attempt) => !transferFullyReversed(attempt.amountCents, attempt.reversedAmountCents)
    )
  ) {
    return {
      allowed: false,
      reason: "transfer_not_fully_reversed",
      pendingClawback: true,
    }
  }

  const reversalWhere = options?.stripeRefundId
    ? { orderId, stripeRefundId: options.stripeRefundId }
    : { orderId }

  const rows = await prisma.transferReversal.findMany({
    where: reversalWhere,
    select: { status: true, stripeTransferId: true },
  })

  if (rows.length === 0) {
    return { allowed: false, reason: "reversal_unknown", pendingClawback: true }
  }

  const transferIds = new Set(reversible.map((row) => row.transferId))
  const rowsForTransfers = rows.filter((row) => transferIds.has(row.stripeTransferId))

  return assessRefundReversalBatch(
    rowsForTransfers,
    transferIds.size,
    requireFullRecovery
  )
}

export async function markRefundPendingClawback(orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" },
  })
  console.log("[payout-reversal-safety]", {
    orderId,
    result: "refund_pending_clawback",
  })
}

export function alertClawbackBlocked(orderId: string, reason: string): void {
  console.log("[payout-reversal-safety]", {
    orderId,
    reason,
    result: "clawback_blocked",
  })
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.captureMessage("Clawback blocked — Stripe reversal not verified", {
      level: "error",
      extra: { orderId, reason },
    })
  }
}
