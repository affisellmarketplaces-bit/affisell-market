import { sendShippingNotificationEmail } from "@/lib/emails/send-shipping-notification"
import { prisma } from "@/lib/prisma"

/** @deprecated Prefer `notifyMarketplaceOrderShipped` or `sendShippingNotificationEmail`. */
export async function sendBuyerTrackingEmail(args: {
  to: string
  orderId: string
  productName: string
  carrier?: string | null
  trackingNumber: string
  trackingUrl?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      customerEmail: true,
      quantity: true,
      trackingNumber: true,
      trackingCarrier: true,
      variantImageUrl: true,
      shippingAddress: true,
      product: { select: { name: true, images: true } },
    },
  })
  if (!order) return { ok: false, error: "order_not_found" }

  return sendShippingNotificationEmail({
    id: order.id,
    customerEmail: args.to,
    quantity: order.quantity,
    trackingNumber: args.trackingNumber,
    trackingCarrier: args.carrier ?? order.trackingCarrier,
    trackingUrl: args.trackingUrl,
    variantImageUrl: order.variantImageUrl,
    shippingAddress: order.shippingAddress,
    product: { name: args.productName, images: order.product.images },
  })
}
