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

/**
 * Order states that come AFTER payment: a payment confirmation must never move an order back to "paid".
 * Every status the code base writes after "paid" (survey of the `Order.status` writers, finalisation review #31):
 * "preparing" (supplier route, orchestrator), "fulfilling" (AliExpress paths: `aliexpress-fulfill-order.ts`, `auto-buy.ts`),
 * "shipped" (mark-shipped, supplier route, tracking webhooks, AutoDS, instant digital fulfilment, orchestrator), "disputed"
 * (chargeback, D7); "delivered" / "completed" / "returned" are read by dashboards and kept for data written by other tools.
 * "fulfilling" used to be missing: every re-run of the transfer scheduler (Stripe retry, second payment event, replay) moved
 * an order the AliExpress paths had just placed back to "paid", i.e. back into the ship-SLA auto-cancel (which refunds).
 */
const POST_PAYMENT_ORDER_STATUSES = new Set([
  "preparing",
  "fulfilling",
  "shipped",
  "delivered",
  "completed",
  "returned",
  "disputed",
])

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
  const lower = value.toLowerCase()
  // A closed status is kept too, never "reopened as paid": the callers reject closed orders first, this is the last line.
  return POST_PAYMENT_ORDER_STATUSES.has(lower) || CLOSED_ORDER_STATUSES.has(lower) ? value : "paid"
}

export type CheckoutFulfilmentSnapshot = OrderPaymentSnapshot & {
  bookingSlotId?: string | null
  bookingConfirmedAt?: Date | null
}

/**
 * Does this order still need the CHECKOUT FULFILMENT (Ghost stock re-check + possible refund, order row creation, buyer
 * e-mails, `fulfillMarketplaceStripeSession`)? Only an order that is not paid yet ("PENDING", empty, unknown pre-payment
 * values) does. An order that is "paid" or past it (preparing, fulfilling, shipped, delivered, …) or closed (refunded,
 * cancelled) must never re-enter it: the stock probe would run against TODAY's supplier stock and could refund a shipped
 * order, and creating the row again hits the `stripeSessionId` unique constraint (finalisation review #9). The one
 * exception is a cancelled booking that was never confirmed: a payment that arrives after its hold expired is recovered by
 * the fulfilment itself.
 */
export function orderAwaitsCheckoutFulfilment(order: CheckoutFulfilmentSnapshot): boolean {
  const status = norm(order.status).toLowerCase()
  if (status === "cancelled" || status === "canceled") {
    return Boolean(order.bookingSlotId) && !order.bookingConfirmedAt
  }
  if (status === "paid" || POST_PAYMENT_ORDER_STATUSES.has(status) || CLOSED_ORDER_STATUSES.has(status)) return false
  // An unknown / pre-payment status already closed by its settlement (lines cancelled by the unallocated-line rule).
  return !CLOSED_SETTLEMENT_STATUSES.has(norm(order.paymentSettlementStatus).toUpperCase())
}

/** True when the order is "paid" or past it (not closed): the checkout fulfilment is done. */
export function orderIsFulfilledForCheckout(order: OrderPaymentSnapshot): boolean {
  const status = norm(order.status).toLowerCase()
  return status === "paid" || POST_PAYMENT_ORDER_STATUSES.has(status)
}

/**
 * Order status written while a payment dispute (chargeback) is open on the charge (finalisation master doc, D7).
 * `Order.status` is a free string, so this needs no migration; it is also in `POST_PAYMENT_ORDER_STATUSES` above, so a
 * late `checkout.session.completed` replay can not move the order back to "paid".
 */
export const DISPUTED_ORDER_STATUS = "disputed"

/** True when the order status says a dispute is open. The dispute ledger (`dispute-hold.server.ts`) is the authority. */
export function isOrderDisputed(order: OrderPaymentSnapshot): boolean {
  return norm(order.status).toLowerCase() === DISPUTED_ORDER_STATUS
}

/**
 * True when no payout may be released: a dispute is open on the charge. The caller passes `openDisputeHold` (the open
 * row of the dispute ledger) because another writer of `Order.status` (tracking webhook, supplier route) can overwrite
 * "disputed" while the dispute is still open: the hold must not depend on the status alone. A held order keeps its
 * pending transfers (nothing is cancelled): they are released once the dispute is won, superseded if it is lost.
 */
export function isOrderPayoutHeldForDispute(order: OrderPaymentSnapshot, openDisputeHold: boolean): boolean {
  return openDisputeHold || isOrderDisputed(order)
}

/**
 * Status to write when a dispute opens: "disputed", except for an order that is already closed (refunded / cancelled:
 * never reopened) or already disputed (nothing to write). `null` = leave the status alone.
 */
export function statusWhenDisputeOpens(order: OrderPaymentSnapshot): string | null {
  if (isOrderClosedForPayout(order)) return null
  if (isOrderDisputed(order)) return null
  return DISPUTED_ORDER_STATUS
}

export type OrderStatusFacts = OrderPaymentSnapshot & {
  shippedAt?: Date | null
  trackingNumber?: string | null
  supplierPreparingAt?: Date | null
}

/**
 * The status an order had before the dispute, rebuilt from its own facts. Only used when the ledger did not keep the
 * exact previous status. Statuses actually written by the code base before payment are paid → preparing → shipped.
 */
export function statusBeforeDispute(order: OrderStatusFacts): string {
  if (order.shippedAt || norm(order.trackingNumber) !== "") return "shipped"
  if (order.supplierPreparingAt) return "preparing"
  return "paid"
}

/**
 * Status to write when a dispute is won / closed without a loss. Only an order still "disputed" is restored: if another
 * writer already moved it (e.g. shipped), or it was refunded meanwhile, the status is left alone (`null`).
 * `previousStatus` = the exact status the ledger recorded when the hold was opened (ignored when empty, closed or disputed).
 */
export function statusWhenDisputeReleased(order: OrderStatusFacts, previousStatus?: string | null): string | null {
  if (!isOrderDisputed(order)) return null
  const previous = norm(previousStatus)
  if (previous !== "" && !isOrderClosedForPayout({ status: previous }) && previous.toLowerCase() !== DISPUTED_ORDER_STATUS) {
    return previous
  }
  return statusBeforeDispute(order)
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

/** Order states that prove the buyer's payment was captured. */
const PAID_ORDER_STATUSES = new Set(["paid", ...POST_PAYMENT_ORDER_STATUSES])

/** Settlement states that prove the payment was captured and the order is not (fully) refunded yet. */
const REFUNDABLE_SETTLEMENT_STATUSES = new Set(["PAID", "SETTLED", "PARTIALLY_REFUNDED"])

/** Settlement states meaning the buyer already got the whole charge back (or the clawback of it is pending). */
const FULLY_REFUNDED_SETTLEMENT_STATUSES = new Set(["REFUNDED", "REFUND_PENDING_CLAWBACK"])

export type RefundEligibilitySnapshot = OrderPaymentSnapshot & {
  paidAt?: Date | string | null
  stripeChargeId?: string | null
}

export type RefundEligibility =
  | { ok: true }
  | { ok: false; reason: "already_refunded" | "order_not_paid" }

/**
 * May a Stripe refund be created for this order? (finalisation master doc, D4)
 *
 *  - `already_refunded`: the status says `refunded`, or the settlement says REFUNDED / REFUND_PENDING_CLAWBACK. Asking
 *    Stripe again would at best be refused, at worst return money twice.
 *  - `order_not_paid`: nothing proves a payment was captured. The proof is POSITIVE (a paid-family status, `paidAt`, a
 *    stored charge id or a PAID / SETTLED / PARTIALLY_REFUNDED settlement), so an unknown or unpaid row fails closed.
 *    A status of `cancelled` does NOT by itself rule a refund out: the booking cancellation writes it BEFORE it refunds
 *    the (paid) order.
 *
 * A refund that is only PARTIAL so far (PARTIALLY_REFUNDED) stays eligible: the cumulative cap lives in
 * `lib/money/refund-guard.ts`.
 */
export function evaluateRefundEligibility(order: RefundEligibilitySnapshot): RefundEligibility {
  const status = norm(order.status).toLowerCase()
  const settlement = norm(order.paymentSettlementStatus).toUpperCase()

  if (status === "refunded" || FULLY_REFUNDED_SETTLEMENT_STATUSES.has(settlement)) {
    return { ok: false, reason: "already_refunded" }
  }
  if (settlement === "CANCELLED") return { ok: false, reason: "order_not_paid" }

  const captured =
    PAID_ORDER_STATUSES.has(status) ||
    REFUNDABLE_SETTLEMENT_STATUSES.has(settlement) ||
    Boolean(order.paidAt) ||
    norm(order.stripeChargeId).length > 0
  return captured ? { ok: true } : { ok: false, reason: "order_not_paid" }
}
