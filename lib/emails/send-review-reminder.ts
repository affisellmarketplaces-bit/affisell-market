import { render } from "@react-email/render"
import { Resend } from "resend"

import { ReviewReminderEmail } from "@/emails/review-reminder"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"

export type ReviewReminderOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  deliveredAt: Date
  affiliateProductId: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  buyer?: { email: string; name: string | null } | null
  product: {
    name: string
    images?: string[] | null
  }
}

function resolveCustomerName(order: ReviewReminderOrderPayload): string {
  if (order.buyer?.name?.trim()) return order.buyer.name.trim()
  if (order.customerName?.trim()) return order.customerName.trim()
  if (order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)) {
    const name = (order.shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = order.customerEmail.split("@")[0]?.trim()
  return local || "Client"
}

function formatDeliveredAtFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export async function sendReviewReminderEmail(
  order: ReviewReminderOrderPayload
): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("review-reminder", order.customerEmail, config)
  const shortOrderId = order.id.slice(-6).toUpperCase()
  const reviewUrl = `${resolveAppUrl()}/marketplace/${order.affiliateProductId}?writeReview=true&orderId=${order.id}`

  const html = await render(
    ReviewReminderEmail({
      orderId: order.id,
      customerName: resolveCustomerName(order),
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      deliveredAt: formatDeliveredAtFr(order.deliveredAt),
      reviewUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Que pensez-vous de votre commande #${shortOrderId} ?`,
    html,
  })

  if (error) {
    console.error("[Resend] Review reminder error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[Resend] Review reminder sent:", data?.id)
  return { ok: true }
}
