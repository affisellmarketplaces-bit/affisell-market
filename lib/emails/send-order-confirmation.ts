import { render } from "@react-email/render"
import { Resend } from "resend"

import { OrderConfirmationEmail } from "@/emails/order-confirmation"
import { readResendEnv } from "@/lib/env/resend"
import { appBaseUrl } from "@/lib/stripe-pro"

const PLACEHOLDER_PRODUCT_IMAGE = "https://via.placeholder.com/64"

export function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    appBaseUrl()
  return raw.replace(/\/$/, "")
}

function resolveCustomerName(
  customerName: string | undefined,
  customerEmail: string
): string {
  if (customerName?.trim()) return customerName.trim()
  const local = customerEmail.split("@")[0]?.trim()
  return local || "Client"
}

/** Maps marketplace line data (Prisma: images string[], variantImageUrl) to email props. */
export function resolveOrderConfirmationImageUrl(args: {
  productImages?: string[] | null
  variantImageUrl?: string | null
}): string {
  const variant = args.variantImageUrl?.trim()
  if (variant) return variant
  const first = args.productImages?.find((u) => typeof u === "string" && u.trim())?.trim()
  return first || PLACEHOLDER_PRODUCT_IMAGE
}

export async function sendOrderConfirmationEmail({
  orderId,
  productName,
  productImageUrl,
  quantity,
  total,
  currency,
  customerEmail,
  customerName,
  orderUrl,
  trackingUrl,
}: {
  orderId: string
  productName: string
  productImageUrl?: string
  quantity: number
  total: string
  currency: string
  customerEmail: string
  customerName?: string
  orderUrl?: string
  trackingUrl?: string
}) {
  const { apiKey, fromEmail, testEmailTo } = readResendEnv()
  if (!apiKey || !fromEmail) {
    console.error("[Resend] Order confirmation skipped: missing RESEND_API_KEY or RESEND_FROM_EMAIL")
    return
  }

  const resend = new Resend(apiKey)
  const FROM = fromEmail

  if (FROM.includes("onboarding@resend.dev") && !testEmailTo) {
    console.error("[Resend] Order confirmation skipped: TEST_EMAIL_TO required when using onboarding@resend.dev")
    return
  }

  const to = FROM.includes("onboarding@resend.dev") ? testEmailTo : customerEmail
  const shortOrderId = orderId.slice(-6).toUpperCase()
  const resolvedOrderUrl = orderUrl ?? `${resolveAppUrl()}/orders/${orderId}`

  const html = await render(
    OrderConfirmationEmail({
      orderId,
      productName,
      productImageUrl: productImageUrl?.trim() || PLACEHOLDER_PRODUCT_IMAGE,
      quantity,
      total,
      currency: currency.toUpperCase(),
      customerName: resolveCustomerName(customerName, customerEmail),
      orderUrl: resolvedOrderUrl,
      trackingUrl: trackingUrl || undefined,
    })
  )

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Commande Affisell #${shortOrderId} confirmée`,
    html,
  })

  if (error) {
    console.error("[Resend] Order confirmation error:", error)
    return
  }
  console.log("[Resend] Order confirmation sent:", data?.id)
}
