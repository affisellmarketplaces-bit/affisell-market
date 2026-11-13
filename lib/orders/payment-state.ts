/**
 * Order / payment state rules shared by transfer scheduling, payout release and settlement.
 * Pure (no I/O) so they can be unit-tested and reused by every writer of `Order.status` / `paymentSettlementStatus`.
 *
 * Why this exists (finalisation master doc, D1): `scheduleMarketplaceTransferAttempts` used to write `status: "paid"` and
 * `paymentSettlementStatus: "PAID"` without reading the current state, so an order that had been refunded (or already
 * shipped) became "paid" again and got PENDING transfers to the supplier and the affiliate. `applyOrderSettlement` could
 * likewise overwrite `REFUNDED` with `SETTLED`.
 *
 * `Order.status` is a free string with mixed case in the data (see `prisma/schema.prisma`), so every comparison here is
 * case-insensitive and unknown values are treated conservatively.
 */

import type { OrderPaymentSettlementStatus } from "@prisma/client"

export type OrderPaymentSnapshot = {
  status?: string | null
  paymentSettlementStatus?: string | null
}

/** Order states from which no payout may be (re)scheduled or released: the money went back to the buyer or never moved. */
const CLOSED_ORDER_STATUSES = new Set(["refunded", "cancelled", "canceled"])

/** Settlement states meaning the charge was refunded (fully, or with a clawback pending) or cancelled. */
const CLOSED_SETTLEMENT_STATUSES = new Set(["REFUNDED", "REFUND_PENDING_CLAWBACK", "CANCELLED"])

/** Order states that come AFTER payment: a payment confirmation must never move an order back to "paid". */
const POST_PAYMENT_ORDER_STATUSES = new Set(["preparing", "shipped", "delivered", "completed", "returned", "disputed"])

/** Settlement states that come after PAID and must be kept when transfers are (re)scheduled. */
const POST_PAID_SETTLEMENT_STATUSES = new Set(["SETTLED", "PARTIALLY_REFUNDED", ...CLOSED_SETTLEMENT_STATUSES])

function norm(value: string | null | undefined): string {
  return (value ?? "").trim()
}

/** True when the order was refunded or cancelled: payouts must not be scheduled or released for it. */
export function isOrderClosedForPayout(order: OrderPaymentSnapshot): boolean {
  if (CLOSED_ORDER_STATUSES.has(norm(order.status).toLowerCase())) return true
  return CLOSED_SETTLEMENT_STATUSES.has(norm(order.paymentSettlementStatus).toUpperCase())
}

/**
 * Status to write when a payment is confirmed. An order that is already past "paid" (preparing, shipped, …) keeps its
 * status; anything earlier (pending, awaiting payment, failed retry, empty) becomes "paid". Closed orders are rejected
 * before this is reached (`isOrderClosedForPayout`).
 */
export function statusAfterPaymentConfirmed(current: string | null | undefined): string {
  const value = norm(current)
  return POST_PAYMENT_ORDER_STATUSES.has(value.toLowerCase()) ? value : "paid"
}

/**
 * Settlement status to write when transfers are scheduled. Only a missing / PENDING settlement becomes PAID; PAID stays
 * PAID, and anything later (SETTLED, PARTIALLY_REFUNDED, refund states) is kept instead of being reset.
 */
export function settlementAfterSchedule(current: string | null | undefined): OrderPaymentSettlementStatus {
  const value = norm(current).toUpperCase()
  return POST_PAID_SETTLEMENT_STATUSES.has(value) ? (value as OrderPaymentSettlementStatus) : "PAID"
}

/**
 * Settlement status to write once every transfer succeeded. SETTLED must never overwrite a refund state: a charge that was
 * refunded after the payouts left stays REFUNDED / REFUND_PENDING_CLAWBACK (the clawback pipeline owns it).
 */
export function settlementAfterTransfersSucceeded(current: string | null | undefined): OrderPaymentSettlementStatus {
  const value = norm(current).toUpperCase()
  return value === "REFUNDED" || value === "REFUND_PENDING_CLAWBACK" || value === "PARTIALLY_REFUNDED" || value === "CANCELLED"
    ? (value as OrderPaymentSettlementStatus)
    : "SETTLED"
}
