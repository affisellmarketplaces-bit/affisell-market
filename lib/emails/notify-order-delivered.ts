import { sendDeliveredNotificationEmail } from "@/lib/emails/send-delivered-notification"
import { notifyOrderDeliveredPush } from "@/lib/order-status-push"
import { prisma } from "@/lib/prisma"

/** Sends React Email delivered notification once per marketplace order. */
export async function notifyOrderDelivered(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerEmail: true,
      quantity: true,
      affiliateProductId: true,
      variantImageUrl: true,
      shippingAddress: true,
      buyerLocale: true,
      deliveredAt: true,
      fulfillmentStatus: true,
      buyerReview: { select: { id: true } },
      product: { select: { name: true, images: true } },
    },
  })
  if (!order?.customerEmail || order.fulfillmentStatus !== "DELIVERED" || order.buyerReview) return

  await sendDeliveredNotificationEmail(
    {
      id: order.id,
      customerEmail: order.customerEmail,
      quantity: order.quantity,
      affiliateProductId: order.affiliateProductId,
      variantImageUrl: order.variantImageUrl,
      shippingAddress: order.shippingAddress,
      product: order.product,
    },
    { locale: order.buyerLocale }
  )

  void notifyOrderDeliveredPush({
    customerEmail: order.customerEmail,
    orderId: order.id,
    productName: order.product.name,
  })
}
