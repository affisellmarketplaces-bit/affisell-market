import { sendShippingNotificationEmail } from "@/lib/emails/send-shipping-notification"
import { prisma } from "@/lib/prisma"

/** Sends React Email shipping notification when marketplace order first ships. */
export async function notifyMarketplaceOrderShipped(
  orderId: string,
  tracking?: {
    trackingNumber: string
    trackingUrl?: string | null
    carrier?: string | null
  }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerEmail: true,
      quantity: true,
      trackingNumber: true,
      trackingCarrier: true,
      variantImageUrl: true,
      shippingAddress: true,
      buyerLocale: true,
      product: { select: { name: true, images: true } },
    },
  })
  if (!order?.customerEmail || !order.trackingNumber) return

  const trackingNumber = tracking?.trackingNumber ?? order.trackingNumber
  if (!trackingNumber) return

  void sendShippingNotificationEmail(
    {
      id: order.id,
      customerEmail: order.customerEmail,
      quantity: order.quantity,
      trackingNumber,
      trackingCarrier: tracking?.carrier ?? order.trackingCarrier,
      trackingUrl: tracking?.trackingUrl ?? undefined,
      variantImageUrl: order.variantImageUrl,
      shippingAddress: order.shippingAddress,
      product: order.product,
    },
    { locale: order.buyerLocale }
  )
}
