import { render } from "@react-email/render"
import { Resend } from "resend"

import { PaymentFailedEmail } from "@/emails/payment-failed"
import {
  defaultEmailCustomerName,
  loadPaymentFailedEmailCopy,
  paymentFailedEmailSubject,
} from "@/lib/emails/load-email-copy"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"
import { getStripeClient } from "@/lib/stripe"
import type { AppLocale } from "@/lib/i18n-locale"

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

function resolveCustomerName(order: PaymentFailedOrderPayload, locale: AppLocale): string {
  if (order.buyer?.name?.trim()) return order.buyer.name.trim()
  if (order.customerName?.trim()) return order.customerName.trim()
  if (order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)) {
    const name = (order.shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = order.customerEmail.split("@")[0]?.trim()
  return local || defaultEmailCustomerName(locale)
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
  stripeCustomerId: string,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string; updatePaymentUrl?: string }> {
  const locale = resolveEmailLocale(options?.locale)
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

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("payment-failed", order.customerEmail, config)

  const copy = loadPaymentFailedEmailCopy(locale, {
    orderId: order.id,
    customerName: resolveCustomerName(order, locale),
  })

  const html = await render(
    PaymentFailedEmail({
      orderId: order.id,
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      updatePaymentUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: paymentFailedEmailSubject(locale, order.id),
    html,
  })

  if (error) {
    console.error("[payment-failed] resend", { orderId: order.id, error: error.message })
    return { ok: false, error: error.message }
  }

  console.log("[payment-failed]", {
    orderId: order.id,
    result: "email_sent",
    resendId: data?.id,
    metric: "payment_failed_email_sent",
  })
  return { ok: true, updatePaymentUrl }
}
