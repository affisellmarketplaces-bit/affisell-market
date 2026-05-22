import { Resend } from "resend"

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

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Commande Affisell #${orderId.slice(-6)} confirmée`,
    html: `
      <h2>Merci pour votre achat!</h2>
      <p>Commande : <strong>${productName}</strong></p>
      <p>Total : <strong>${(total / 100).toFixed(2)} ${currency.toUpperCase()}</strong></p>
      <p>Numéro : <strong>#${orderId.slice(-6)}</strong></p>
      <p>Vous recevrez un email dès que votre colis est expédié avec le numéro de suivi.</p>
    `,
  })

  if (error) {
    console.error("[Resend] Order confirmation error:", error)
    return
  }
  console.log("[Resend] Order confirmation sent:", data?.id)
}
