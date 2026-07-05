export type IncrementalReversalInput = {
  originalCents: number
  reversedSoFar: number
  refundAmountCents: number
  orderTotalCents: number
  isFullRefund: boolean
}

export type IncrementalReversalPlan = {
  reverseCents: number
  availableCents: number
  skipReason?: "fully_reversed" | "partial_below_cent"
}

/** Proportional share of a single refund event (not cumulative). */
export function proportionalRefundShareCents(
  transferCents: number,
  refundCents: number,
  orderTotalCents: number
): number {
  if (orderTotalCents < 1 || transferCents < 1 || refundCents < 1) return 0
  const ratio = Math.min(1, Math.max(0, refundCents / orderTotalCents))
  return Math.max(0, Math.round(transferCents * ratio))
}

/**
 * Incremental reversal plan — never exceeds remaining transfer balance.
 * available = originalAmount - reversedAmountCents
 */
export function computeIncrementalReversalCents(
  input: IncrementalReversalInput
): IncrementalReversalPlan {
  const originalCents = Math.max(0, Math.round(input.originalCents))
  const reversedSoFar = Math.max(0, Math.round(input.reversedSoFar))
  const availableCents = Math.max(0, originalCents - reversedSoFar)

  if (availableCents < 1) {
    return { reverseCents: 0, availableCents: 0, skipReason: "fully_reversed" }
  }

  const thisRefundShare = input.isFullRefund
    ? availableCents
    : proportionalRefundShareCents(
        originalCents,
        input.refundAmountCents,
        Math.max(1, Math.round(input.orderTotalCents))
      )

  const reverseCents = Math.min(thisRefundShare, availableCents)

  if (reverseCents < 1) {
    return { reverseCents: 0, availableCents, skipReason: "partial_below_cent" }
  }

  return { reverseCents, availableCents }
}

export function transferFullyReversed(originalCents: number, reversedSoFar: number): boolean {
  return reversedSoFar >= Math.max(0, Math.round(originalCents))
}

/** @deprecated Use proportionalRefundShareCents — kept for existing tests/imports. */
export function proportionalCents(
  transferCents: number,
  refundCents: number,
  orderTotalCents: number
): number {
  return proportionalRefundShareCents(transferCents, refundCents, orderTotalCents)
}
