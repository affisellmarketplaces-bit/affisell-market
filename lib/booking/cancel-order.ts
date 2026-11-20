import { prisma } from "@/lib/prisma"

import {
  releaseConfirmedBookingSeatsInTransaction,
} from "@/lib/booking/slot-hold"

export type CancelBookingOrderResult =
  | { ok: true; stripeRefundId?: string; refundPending: boolean }
  | { ok: false; error: string; status?: number }

/**
 * Buyer-initiated booking cancellation inside free window: release seats + Stripe refund.
 * Idempotent if already cancelled/refunded.
 */
export async function cancelBookingOrderForBuyer(args: {
  orderId: string
  buyerUserId: string | null
  buyerEmail: string
}): Promise<CancelBookingOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      status: true,
      quantity: true,
      customerEmail: true,
      buyerUserId: true,
      buyerLocale: true,
      bookingSlotId: true,
      bookingSnapshot: true,
      bookingConfirmedAt: true,
      bookingCancelledAt: true,
      bookingToken: true,
      listingKindSnapshot: true,
      paymentSettlementStatus: true,
      product: { select: { name: true } },
    },
  })

  if (!order) return { ok: false, error: "order_not_found", status: 404 }

  const emailMatch =
    order.customerEmail.trim().toLowerCase() === args.buyerEmail.trim().toLowerCase()
  const userMatch = args.buyerUserId && order.buyerUserId === args.buyerUserId
  if (!emailMatch && !userMatch) {
    return { ok: false, error: "forbidden", status: 403 }
  }

  // Done only when the money went back. A booking already cancelled by an earlier attempt whose refund FAILED is not
  // done: the buyer's retry goes straight to the refund (finalisation D5 — that retry used to answer "ok" and the refund
  // was never made again: seats released, order "cancelled", buyer still charged).
  const settlement = (order.paymentSettlementStatus ?? "").trim().toUpperCase()
  if (order.status === "refunded" || settlement === "REFUNDED" || settlement === "REFUND_PENDING_CLAWBACK") {
    return { ok: true, refundPending: false }
  }
  const alreadyCancelled = Boolean(order.bookingCancelledAt) || order.status === "cancelled"
  if (alreadyCancelled && settlement === "CANCELLED") {
    // Cancelled before any payment was captured (e.g. an unpaid hold): nothing to refund.
    return { ok: true, refundPending: false }
  }

  if (!alreadyCancelled) {
    if (!order.bookingConfirmedAt || !order.bookingSlotId) {
      return { ok: false, error: "not_a_confirmed_booking", status: 400 }
    }

    const { canBuyerCancelBooking } = await import("@/lib/booking/cancellation-policy")
    const cancelCheck = canBuyerCancelBooking({
      bookingSnapshot: order.bookingSnapshot,
      bookingConfirmedAt: order.bookingConfirmedAt,
    })
    if (!cancelCheck.allowed) {
      return { ok: false, error: cancelCheck.reason ?? "past_deadline", status: 409 }
    }
  }

  if (!alreadyCancelled) await prisma.$transaction(async (tx) => {
    await releaseConfirmedBookingSeatsInTransaction(tx, {
      orderId: order.id,
      slotId: order.bookingSlotId!,
      quantity: order.quantity,
    })
    await tx.order.update({
      where: { id: order.id },
      data: {
        bookingCancelledAt: new Date(),
        status: "cancelled",
        fulfillmentStatus: "FAILED",
      },
    })
  })

  const { initiateMarketplaceRefundPipeline } = await import("@/lib/marketplace-refund-pipeline")
  const refund = await initiateMarketplaceRefundPipeline({
    orderId: order.id,
    source: "booking_buyer_cancel",
    reason: "requested_by_customer",
  })

  console.log("[booking]", {
    orderId: order.id,
    result: refund.ok ? "buyer_cancel_refund_initiated" : "buyer_cancel_refund_failed",
    stripeRefundId: refund.stripeRefundId ?? null,
    error: refund.error ?? refund.skipped ?? null,
  })

  if (!refund.ok && refund.skipped !== "already_refunded") {
    // The booking stays cancelled (seats released) and NOT refunded: a retry of this call re-attempts the refund (the
    // pipeline is idempotent and capped). A human must know if nobody retries.
    const { opsWebhookAlert } = await import("@/lib/ops-webhook")
    await opsWebhookAlert(
      `Réservation ${order.id} annulée par l'acheteur mais remboursement Stripe en échec (${refund.error ?? refund.skipped ?? "inconnu"}). ` +
        `L'acheteur peut réessayer ; sinon rembourser depuis l'admin.`
    ).catch(() => undefined)
    return { ok: false, error: refund.error ?? "refund_failed", status: 502 }
  }

  if (alreadyCancelled) {
    // A retry after a failed refund: the cancellation e-mail and the waitlist already went out the first time.
    return { ok: true, stripeRefundId: refund.stripeRefundId, refundPending: true }
  }

  const { processBookingWaitlistNotifications } = await import("@/lib/booking/waitlist")
  void processBookingWaitlistNotifications(20)

  const { sendBookingCancellationEmail } = await import("@/lib/emails/send-booking-cancellation")
  void sendBookingCancellationEmail({
    orderId: order.id,
    productName: order.product.name,
    customerEmail: order.customerEmail,
    bookingSnapshot: order.bookingSnapshot,
    buyerLocale: order.buyerLocale,
  })

  return { ok: true, stripeRefundId: refund.stripeRefundId, refundPending: true }
}

export { releaseBookingSlotHoldForOrder } from "@/lib/booking/slot-hold"
