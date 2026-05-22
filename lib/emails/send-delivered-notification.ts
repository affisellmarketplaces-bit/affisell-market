import { render } from "@react-email/render"
import { Resend } from "resend"

import { DeliveredNotificationEmail } from "@/emails/delivered-notification"
import { readResendEnv } from "@/lib/env/resend"
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
  const { apiKey, fromEmail, testEmailTo } = readResendEnv()
  if (!apiKey || !fromEmail) {
    console.error("[Resend] Delivered notification skipped: missing RESEND_API_KEY or RESEND_FROM_EMAIL")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const resend = new Resend(apiKey)
  const FROM = fromEmail

  if (FROM.includes("onboarding@resend.dev") && !testEmailTo) {
    console.error("[Resend] Delivered notification skipped: TEST_EMAIL_TO required when using onboarding@resend.dev")
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const to = FROM.includes("onboarding@resend.dev") ? testEmailTo : order.customerEmail
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
    from: FROM,
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
