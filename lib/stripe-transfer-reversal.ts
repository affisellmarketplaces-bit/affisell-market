import type { TransferRole } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export type TransferReversalOutcome = {
  orderId: string
  role: TransferRole | "LIGHTNING"
  transferId: string
  amountCents: number
  status: "reversed" | "skipped" | "warning"
  reason?: string
  reversalId?: string
}

function reversalIdempotencyKey(orderId: string, transferId: string, refundKey: string): string {
  return `reversal_${orderId}_${transferId}_${refundKey}`
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

export async function reverseConnectTransfersForRefund(args: {
  orderId: string
  refundAmountCents: number
  orderTotalCents: number
  isFullRefund: boolean
  refundKey: string
}): Promise<TransferReversalOutcome[]> {
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
  if (!order) return []

  const transfers = resolveReversibleTransfers({
    transferAttempts: order.transferAttempts,
    payoutTransferIds: order.payoutTransferIds,
  })
  if (transfers.length === 0) {
    console.log("[stripe-reversal]", { orderId: args.orderId, result: "no_transfers" })
    return []
  }

  const stripe = getStripeClient()
  const outcomes: TransferReversalOutcome[] = []
  const orderTotal = Math.max(1, Math.round(args.orderTotalCents))

  for (const row of transfers) {
    let amountCents = row.amountCents
    if (amountCents < 1) {
      amountCents =
        row.role === "SUPPLIER"
          ? order.supplierPayoutCents
          : row.role === "AFFILIATE"
            ? order.affiliatePayoutCents
            : 0
    }
    if (amountCents < 1) {
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: 0,
        status: "skipped",
        reason: "unknown_transfer_amount",
      })
      continue
    }

    const reverseCents = args.isFullRefund
      ? amountCents
      : proportionalCents(amountCents, args.refundAmountCents, orderTotal)

    if (reverseCents < 1) {
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: 0,
        status: "skipped",
        reason: "partial_below_cent",
      })
      continue
    }

    try {
      const reversal = await stripe.transfers.createReversal(
        row.transferId,
        { amount: reverseCents },
        { idempotencyKey: reversalIdempotencyKey(args.orderId, row.transferId, args.refundKey) }
      )
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: reverseCents,
        status: "reversed",
        reversalId: reversal.id,
      })
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: reverseCents,
        reversalId: reversal.id,
        result: "reversed",
      })
    } catch (error) {
      if (isAlreadyReversedError(error)) {
        outcomes.push({
          orderId: args.orderId,
          role: row.role,
          transferId: row.transferId,
          amountCents: reverseCents,
          status: "warning",
          reason: "already_reversed",
        })
        console.log("[stripe-reversal]", {
          orderId: args.orderId,
          transferId: row.transferId,
          result: "already_reversed",
        })
        continue
      }
      const reason = error instanceof Error ? error.message : String(error)
      outcomes.push({
        orderId: args.orderId,
        role: row.role,
        transferId: row.transferId,
        amountCents: reverseCents,
        status: "warning",
        reason,
      })
      console.log("[stripe-reversal]", {
        orderId: args.orderId,
        transferId: row.transferId,
        result: "error",
        reason,
      })
    }
  }

  return outcomes
}

export { proportionalCents, isAlreadyReversedError }
