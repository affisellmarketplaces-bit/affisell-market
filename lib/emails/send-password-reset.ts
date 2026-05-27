import { render } from "@react-email/render"
import { Resend } from "resend"

import { PasswordResetEmail } from "@/emails/password-reset"
import { readResendEnv } from "@/lib/env/resend"

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string
  name?: string | null
  resetUrl: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { apiKey, fromEmail, testEmailTo } = readResendEnv()
  if (!apiKey) {
    console.error("[auth-forgot-password]", { result: "no_resend_key" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const FROM = fromEmail || "Affisell <onboarding@resend.dev>"
  const recipient =
    FROM.includes("onboarding@resend.dev") && testEmailTo ? testEmailTo : to

  if (FROM.includes("onboarding@resend.dev") && !testEmailTo) {
    console.error("[auth-forgot-password]", {
      result: "skipped",
      reason: "TEST_EMAIL_TO required with onboarding@resend.dev",
    })
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const html = await render(PasswordResetEmail({ name, resetUrl }))
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM,
    to: recipient,
    subject: "Réinitialisez votre mot de passe Affisell",
    html,
  })

  if (error) {
    console.error("[auth-forgot-password]", { result: "resend_error", message: error.message })
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
