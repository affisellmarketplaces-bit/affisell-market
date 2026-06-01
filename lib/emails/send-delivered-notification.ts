import { render } from "@react-email/render"
import { Resend } from "resend"

import { DeliveredNotificationEmail } from "@/emails/delivered-notification"
import {
  readResendDeliveryConfig,
  resendSandboxNeedsTestInbox,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"

export type DeliveredNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  affiliateProductId: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  product: {
    name: string
    images?: string[] | null
  }
}

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

export async function sendDeliveredNotificationEmail(
  order: DeliveredNotificationOrderPayload
): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Delivered notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  if (resendSandboxNeedsTestInbox(config)) {
    console.error("[Resend] Delivered notification skipped: TEST_EMAIL_TO required when using onboarding@resend.dev")
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("delivered-notification", order.customerEmail, config)
  const base = resolveAppUrl()
  const orderUrl = `${base}/marketplace/account/orders`
  const reviewUrl = `${base}/marketplace/${order.affiliateProductId}?writeReview=true&orderId=${order.id}`
  const repurchaseUrl = `${base}/marketplace/${order.affiliateProductId}?ref=repurchase`
  const shortOrderId = order.id.slice(-6).toUpperCase()

  const html = await render(
    DeliveredNotificationEmail({
      orderId: order.id,
      customerName: resolveCustomerName(order.customerName, order.customerEmail, order.shippingAddress),
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      quantity: order.quantity,
      orderUrl,
      reviewUrl,
      repurchaseUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Votre commande #${shortOrderId} est livrée`,
    html,
  })

  if (error) {
    console.error("[Resend] Delivered notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[Resend] Delivered notification sent:", data?.id)
  return { ok: true }
}
