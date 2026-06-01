import { render } from "@react-email/render"
import { Resend } from "resend"

import { PaymentFailedEmail } from "@/emails/payment-failed"
import {
  readResendDeliveryConfig,
  resendSandboxNeedsTestInbox,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"
import { getStripeClient } from "@/lib/stripe"

export type PaymentFailedOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  buyer?: { email: string; name: string | null; stripeCustomerId?: string | null } | null
  product: {
    name: string
    images?: string[] | null
  }
}

function resolveCustomerName(order: PaymentFailedOrderPayload): string {
  if (order.buyer?.name?.trim()) return order.buyer.name.trim()
  if (order.customerName?.trim()) return order.customerName.trim()
  if (order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)) {
    const name = (order.shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = order.customerEmail.split("@")[0]?.trim()
  return local || "Client"
}

export async function createStripeBillingPortalUrl(stripeCustomerId: string): Promise<string> {
  const stripe = getStripeClient()
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${resolveAppUrl()}/marketplace/account/orders`,
  })
  if (!session.url) {
    throw new Error("billing_portal_session_missing_url")
  }
  return session.url
}

export async function sendPaymentFailedEmail(
  order: PaymentFailedOrderPayload,
  stripeCustomerId: string
): Promise<{ ok: boolean; error?: string; updatePaymentUrl?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  let updatePaymentUrl: string
  try {
    updatePaymentUrl = await createStripeBillingPortalUrl(stripeCustomerId)
  } catch (e) {
    const message = e instanceof Error ? e.message : "billing_portal_failed"
    console.error("[payment-failed] billing portal", { orderId: order.id, error: message })
    return { ok: false, error: message }
  }

  if (resendSandboxNeedsTestInbox(config)) {
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("payment-failed", order.customerEmail, config)
  const shortOrderId = order.id.slice(-6).toUpperCase()

  const html = await render(
    PaymentFailedEmail({
      orderId: order.id,
      customerName: resolveCustomerName(order),
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      updatePaymentUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Action requise : paiement refusé pour #${shortOrderId}`,
    html,
  })

  if (error) {
    console.error("[payment-failed] resend", { orderId: order.id, error: error.message })
    return { ok: false, error: error.message }
  }

  console.log("[payment-failed] email_sent", {
    orderId: order.id,
    resendId: data?.id,
    metric: "payment_failed_email_sent",
  })
  return { ok: true, updatePaymentUrl }
}
