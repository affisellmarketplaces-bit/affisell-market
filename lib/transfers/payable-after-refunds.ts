import { proportionalRefundShareCents } from "@/lib/transfer-reversal-amounts"

/**
 * What a PENDING transfer may still pay once part of the sale went back to the buyer. Pure.
 *
 * The rule is the SAME as the clawback of a transfer that was already paid (`clawbackOrderPayoutsOnPartialRefund`):
 * for each refund, the beneficiary gives up `proportionalRefundShareCents(scheduled, refund, chargedTotal)` — same
 * base (the scheduled transfer, `TransferAttempt.amountCents`), same total (`orderChargedTotalCents`), same rounding,
 * refund by refund. So the beneficiary ends with the same amount whatever the order of events: refund then payout
 * (paid less) or payout then refund (paid in full, then clawed back).
 *
 * Before this, a partial refund recorded before the payout changed nothing for a PENDING transfer: the clawback only
 * looks at roles already paid, and PARTIALLY_REFUNDED is not a closed state — the full share left anyway.
 */
export function payableAfterRefunds(args: {
  scheduledCents: number
  refundCents: readonly number[]
  orderChargedTotalCents: number
}): { payableCents: number; refundShareCents: number } {
  const scheduled = Math.max(0, Math.round(args.scheduledCents))
  let share = 0
  for (const r of args.refundCents) share += proportionalRefundShareCents(scheduled, r, args.orderChargedTotalCents)
  share = Math.min(scheduled, share)
  return { payableCents: scheduled - share, refundShareCents: share }
}

/** A Stripe transfer this attempt may already have created (a crash between the call and its record). */
export type ExistingTransfer = { id: string; amount: number; reversed: boolean }

/**
 * Pick, among the transfers of the order's transfer group, the one this attempt created: same role in its metadata
 * and same destination. One attempt per (order, role) is a database invariant (`@@unique([orderId, role])`) and the
 * idempotency key is `transfer_{orderId}_{role}`, so there is at most one legitimate match.
 */
export function matchExistingTransfer(
  transfers: ReadonlyArray<{
    id: string
    amount: number
    destination: string | { id: string } | null
    metadata?: Record<string, string> | null
    reversed?: boolean
  }>,
  wanted: { role: string; destination: string },
): ExistingTransfer | null {
  for (const t of transfers) {
    const dest = typeof t.destination === "string" ? t.destination : (t.destination?.id ?? null)
    if (t.metadata?.role === wanted.role && dest === wanted.destination) {
      return { id: t.id, amount: t.amount, reversed: Boolean(t.reversed) }
    }
  }
  return null
}
