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

type ListedTransfer = {
  id: string
  amount: number
  destination: string | { id: string } | null
  metadata?: Record<string, string | undefined> | null
  reversed?: boolean
}

/**
 * Every transfer of the order's transfer group that already paid THIS beneficiary: same destination, and a `role` in
 * its metadata that is this role whatever its case — or no role at all. Rails write the role differently
 * (process-transfers `SUPPLIER`, Lightning and the legacy Connect helper `supplier`), and a transfer to the same account
 * in the same group with no role is still money this beneficiary received for this order. Fail-safe by design: the cost
 * of a false match is a held payout for a person, the cost of a miss is paying twice — which is what happened on the
 * Test order cmpjs9s0m0007th1idac73yny (24/05/2026: four `supplier` transfers, then a fifth `SUPPLIER` one).
 */
export function findExistingTransfers(
  transfers: ReadonlyArray<ListedTransfer>,
  wanted: { role: string; destination: string },
): ExistingTransfer[] {
  const role = wanted.role.toUpperCase()
  const out: ExistingTransfer[] = []
  for (const t of transfers) {
    const dest = typeof t.destination === "string" ? t.destination : (t.destination?.id ?? null)
    if (dest !== wanted.destination) continue
    const theirs = t.metadata?.role
    if (theirs !== undefined && theirs !== null && theirs !== "" && theirs.toUpperCase() !== role) continue
    out.push({ id: t.id, amount: t.amount, reversed: Boolean(t.reversed) })
  }
  return out
}

/**
 * The one transfer this leg already has, or null. Several = an anomaly (a past double payment): callers must hold
 * rather than adopt one at random — see `findExistingTransfers`.
 */
export function matchExistingTransfer(
  transfers: ReadonlyArray<ListedTransfer>,
  wanted: { role: string; destination: string },
): ExistingTransfer | null {
  const found = findExistingTransfers(transfers, wanted)
  return found.length === 1 ? found[0]! : null
}
