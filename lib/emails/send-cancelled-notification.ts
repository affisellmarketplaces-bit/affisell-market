import { render } from "@react-email/render"
import { Resend } from "resend"

import { CancelledNotificationEmail } from "@/emails/cancelled-notification"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"

export type CancelledNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  sellingPriceCents: number
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

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

export async function sendCancelledNotificationEmail(
  order: CancelledNotificationOrderPayload,
  options?: {
    cancelReason?: string
    refundAmountCents?: number
  }
): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Cancelled notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("cancelled-notification", order.customerEmail, config)
  const base = resolveAppUrl()
  const orderUrl = `${base}/marketplace/account/orders`
  const supportUrl = `${base}/contact?order=${order.id}`
  const shortOrderId = order.id.slice(-6).toUpperCase()
  const totalAmount = formatMoney(order.sellingPriceCents)
  const refundCents = options?.refundAmountCents ?? order.sellingPriceCents
  const currency = "EUR"

  const html = await render(
    CancelledNotificationEmail({
      orderId: order.id,
      customerName: resolveCustomerName(order.customerName, order.customerEmail, order.shippingAddress),
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      quantity: order.quantity,
      totalAmount,
      currency,
      cancelReason: options?.cancelReason,
      refundAmount: formatMoney(refundCents),
      orderUrl,
      supportUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Votre commande #${shortOrderId} a été annulée`,
    html,
  })

  if (error) {
    console.error("[Resend] Cancelled notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[Resend] Cancelled notification sent:", data?.id)
  return { ok: true }
}
