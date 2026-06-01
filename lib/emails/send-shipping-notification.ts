import { render } from "@react-email/render"
import { Resend } from "resend"

import { ShippingNotificationEmail } from "@/emails/shipping-notification"
import {
  readResendDeliveryConfig,
  resendSandboxNeedsTestInbox,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"

const PLACEHOLDER_PRODUCT_IMAGE = "https://via.placeholder.com/64"

function resolveCustomerName(
  customerName: string | undefined,
  customerEmail: string,
  shippingAddress?: unknown
): string {
  if (customerName?.trim()) return customerName.trim()
  if (shippingAddress && typeof shippingAddress === "object" && !Array.isArray(shippingAddress)) {
    const name = (shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = customerEmail.split("@")[0]?.trim()
  return local || "Client"
}

export type ShippingNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  trackingNumber: string
  trackingCarrier?: string | null
  trackingUrl?: string | null
  variantImageUrl?: string | null
  shippingAddress?: unknown
  product: {
    name: string
    images?: string[] | null
  }
}

export async function sendShippingNotificationEmail(
  order: ShippingNotificationOrderPayload
): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Shipping notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  if (resendSandboxNeedsTestInbox(config)) {
    console.error("[Resend] Shipping notification skipped: TEST_EMAIL_TO required when using onboarding@resend.dev")
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("shipping-notification", order.customerEmail, config)
  const orderUrl = `${resolveAppUrl()}/orders/${order.id}`
  const trackingUrl =
    order.trackingUrl?.trim() ||
    `${resolveAppUrl()}/marketplace/account/orders`
  const carrier = order.trackingCarrier?.trim() || "Transporteur"
  const shortOrderId = order.id.slice(-6).toUpperCase()

  const html = await render(
    ShippingNotificationEmail({
      orderId: order.id,
      customerName: resolveCustomerName(order.customerName, order.customerEmail, order.shippingAddress),
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      quantity: order.quantity,
      trackingUrl,
      trackingNumber: order.trackingNumber,
      carrier,
      orderUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Votre commande #${shortOrderId} est expédiée`,
    html,
  })

  if (error) {
    console.error("[Resend] Shipping notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[Resend] Shipping notification sent:", data?.id)
  return { ok: true }
}
