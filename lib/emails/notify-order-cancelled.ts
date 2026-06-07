import { sendCancelledNotificationEmail } from "@/lib/emails/send-cancelled-notification"
import { prisma } from "@/lib/prisma"

export type NotifyOrderCancelledOptions = {
  cancelReason?: string
  refundAmountCents?: number
  markRefunded?: boolean
}

/**
 * Sends cancelled email once per order (`cancelledEmailSentAt` guard).
 */
export async function notifyOrderCancelled(
  orderId: string,
  options?: NotifyOrderCancelledOptions
): Promise<{ sent: boolean; error?: string }> {
  const claim = await prisma.order.updateMany({
    where: { id: orderId, cancelledEmailSentAt: null },
    data: {
      cancelledEmailSentAt: new Date(),
      ...(options?.markRefunded !== false ? { status: "refunded" } : {}),
    },
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
