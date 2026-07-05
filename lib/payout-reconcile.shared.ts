import type Stripe from "stripe"

/** Net Stripe transfer balance after reversals. */
export function stripeTransferNetCents(transfer: {
  amount?: number | null
  amount_reversed?: number | null
}): number {
  const gross = Math.max(0, transfer.amount ?? 0)
  const reversed = Math.max(0, transfer.amount_reversed ?? 0)
  return Math.max(0, gross - reversed)
}

/** Net Connect payout from local TransferAttempt rows. */
export function transferAttemptsNetCents(
  attempts: Array<{ amountCents: number; reversedAmountCents?: number | null }>
): number {
  return attempts.reduce(
    (sum, attempt) =>
      sum + Math.max(0, attempt.amountCents - Math.max(0, attempt.reversedAmountCents ?? 0)),
    0
  )
}

export type LedgerRow = {
  entryType: string
  amountCents: number
  payoutRail?: string | null
}

/** Ledger net excluding phantom_legacy audit rows. */
export function netRealizedLedgerCents(rows: LedgerRow[]): number {
  let net = 0
  for (const row of rows) {
    if (row.payoutRail === "phantom_legacy") continue
    if (row.entryType === "CLAWBACK") net -= row.amountCents
    else net += row.amountCents
  }
  return net
}

export const PAYOUT_RECONCILE_TOLERANCE_CENTS = 1

export function payoutReconcileExceedsTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) > PAYOUT_RECONCILE_TOLERANCE_CENTS
}

export type PayoutReconcileDivergenceKind =
  | "ledger_vs_expected"
  | "attempt_vs_expected"
  | "attempt_net_vs_stripe_net"
  | "ledger_vs_attempt"
  | "ledger_vs_stripe_net"

export type PayoutReconcileDivergence = {
  orderId: string
  kind: PayoutReconcileDivergenceKind
  expectedCents: number
  actualCents: number
  deltaCents: number
  detail?: string
}

export type PayoutOrderReconcileInput = {
  orderId: string
  supplierPayoutCents: number
  affiliatePayoutCents: number
  merchantPayoutLedger: LedgerRow[]
  transferAttempts: Array<{
    amountCents: number
    reversedAmountCents?: number | null
    stripeTransferId?: string | null
    role?: string
  }>
}

export type StripeTransferFetcher = (
  transferId: string
) => Promise<Pick<Stripe.Transfer, "amount" | "amount_reversed"> | null>

export async function reconcileSingleOrderPayouts(
  order: PayoutOrderReconcileInput,
  fetchStripeTransfer: StripeTransferFetcher
): Promise<PayoutReconcileDivergence[]> {
  const divergences: PayoutReconcileDivergence[] = []
  const successAttempts = order.transferAttempts.filter((a) => a.stripeTransferId?.trim())

  if (successAttempts.length === 0 && order.merchantPayoutLedger.length === 0) {
    return divergences
  }

  const expectedCents = order.supplierPayoutCents + order.affiliatePayoutCents
  const ledgerCents = netRealizedLedgerCents(order.merchantPayoutLedger)
  const attemptGrossCents = successAttempts.reduce((sum, a) => sum + a.amountCents, 0)
  const attemptNetCents = transferAttemptsNetCents(successAttempts)

  if (expectedCents > 0 && payoutReconcileExceedsTolerance(ledgerCents, expectedCents)) {
    divergences.push({
      orderId: order.orderId,
      kind: "ledger_vs_expected",
      expectedCents,
      actualCents: ledgerCents,
      deltaCents: ledgerCents - expectedCents,
    })
  }

  if (expectedCents > 0 && payoutReconcileExceedsTolerance(attemptGrossCents, expectedCents)) {
    divergences.push({
      orderId: order.orderId,
      kind: "attempt_vs_expected",
      expectedCents,
      actualCents: attemptGrossCents,
      deltaCents: attemptGrossCents - expectedCents,
    })
  }

  if (successAttempts.length > 0 && payoutReconcileExceedsTolerance(ledgerCents, attemptGrossCents)) {
    divergences.push({
      orderId: order.orderId,
      kind: "ledger_vs_attempt",
      expectedCents: attemptGrossCents,
      actualCents: ledgerCents,
      deltaCents: ledgerCents - attemptGrossCents,
    })
  }

  const transferIds = successAttempts
    .map((a) => a.stripeTransferId?.trim())
    .filter((id): id is string => Boolean(id))

  if (transferIds.length > 0) {
    let stripeNetCents = 0
    const stripeDetails: string[] = []
    for (const transferId of transferIds) {
      const transfer = await fetchStripeTransfer(transferId)
      if (!transfer) {
        divergences.push({
          orderId: order.orderId,
          kind: "attempt_net_vs_stripe_net",
          expectedCents: attemptNetCents,
          actualCents: -1,
          deltaCents: -1,
          detail: `stripe_fetch_error:${transferId}`,
        })
        return divergences
      }
      const net = stripeTransferNetCents(transfer)
      stripeNetCents += net
      stripeDetails.push(`${transferId}=${net}`)
    }

    if (payoutReconcileExceedsTolerance(stripeNetCents, attemptNetCents)) {
      divergences.push({
        orderId: order.orderId,
        kind: "attempt_net_vs_stripe_net",
        expectedCents: attemptNetCents,
        actualCents: stripeNetCents,
        deltaCents: stripeNetCents - attemptNetCents,
        detail: stripeDetails.join(","),
      })
    }

    if (payoutReconcileExceedsTolerance(ledgerCents, stripeNetCents)) {
      divergences.push({
        orderId: order.orderId,
        kind: "ledger_vs_stripe_net",
        expectedCents: stripeNetCents,
        actualCents: ledgerCents,
        deltaCents: ledgerCents - stripeNetCents,
        detail: stripeDetails.join(","),
      })
    }
  }

  return divergences
}

export function logPayoutReconcileDivergence(divergence: PayoutReconcileDivergence): void {
  console.log("[reconcile-payouts]", {
    orderId: divergence.orderId,
    kind: divergence.kind,
    expectedCents: divergence.expectedCents,
    actualCents: divergence.actualCents,
    deltaCents: divergence.deltaCents,
    detail: divergence.detail ?? null,
    result: "divergence",
  })
}
