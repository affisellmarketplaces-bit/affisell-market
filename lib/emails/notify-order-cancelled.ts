import { sendCancelledNotificationEmail } from "@/lib/emails/send-cancelled-notification"
import { prisma } from "@/lib/prisma"

export type NotifyOrderCancelledOptions = {
  cancelReason?: string
  refundAmountCents?: number
  /**
   * Id of a Stripe refund that Stripe ACCEPTED for this order. It is the only thing that lets this function write
   * `status: "refunded"` (finalisation master doc, D5): `refunded` must mean money went back to the buyer, so a cancel
   * whose refund failed, was never attempted or is still unknown passes nothing here and the status is left alone.
   */
  stripeRefundId?: string
}

/**
 * Sends cancelled email once per order (`cancelledEmailSentAt` guard).
 * Marks the order `refunded` ONLY when `options.stripeRefundId` is given.
 */
export async function notifyOrderCancelled(
  orderId: string,
  options?: NotifyOrderCancelledOptions
): Promise<{ sent: boolean; error?: string }> {
  if (options?.stripeRefundId?.trim()) {
    // Independent of the email claim below: a replay after the email went out must still record the refund.
    await prisma.order.updateMany({
      where: { id: orderId, NOT: { status: "refunded" } },
      data: { status: "refunded" },
    })
  }

  const claim = await prisma.order.updateMany({
    where: { id: orderId, cancelledEmailSentAt: null },
    data: { cancelledEmailSentAt: new Date() },
  })
  if (claim.count === 0) return { sent: false }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerEmail: true,
      quantity: true,
      sellingPriceCents: true,
      variantImageUrl: true,
      shippingAddress: true,
      buyerLocale: true,
      product: { select: { name: true, images: true } },
    },
  })
  if (!order?.customerEmail) return { sent: false, error: "order_not_found" }

  const result = await sendCancelledNotificationEmail(order, {
    cancelReason: options?.cancelReason,
    refundAmountCents: options?.refundAmountCents,
    locale: order.buyerLocale,
  })
  return { sent: result.ok, error: result.error }
}
