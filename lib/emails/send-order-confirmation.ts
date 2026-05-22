import { render } from "@react-email/render"
import { createElement } from "react"
import { Resend } from "resend"

import { OrderConfirmationEmail } from "@/emails/order-confirmation"
import { readResendEnv } from "@/lib/env/resend"

export async function sendOrderConfirmationEmail({
  orderId,
  productName,
  total,
  currency,
  customerEmail,
}: {
  orderId: string
  productName: string
  total: number
  currency: string
  customerEmail: string
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

  const emailHtml = await render(
    createElement(OrderConfirmationEmail, {
      orderId,
      productName,
      total,
      currency,
      customerEmail,
    })
  )

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Commande Affisell #${shortOrderId} confirmée`,
    html: emailHtml,
  })

  if (error) {
    console.error("[Resend] Order confirmation error:", error)
    return
  }
  console.log("[Resend] Order confirmation sent:", data?.id)
}
