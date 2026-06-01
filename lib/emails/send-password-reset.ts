import {
  PasswordResetEmail,
  type PasswordResetPortal,
} from "@/emails/password-reset"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"

export async function sendPasswordResetEmail({
  accountEmail,
  name,
  resetUrl,
  portal = null,
}: {
  accountEmail: string
  name?: string | null
  resetUrl: string
  portal?: PasswordResetPortal
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedAccount = accountEmail.trim().toLowerCase()
  if (!normalizedAccount.includes("@")) {
    console.error("[auth-forgot-password]", { result: "invalid_account_email" })
    return { ok: false, error: "invalid_account_email" }
  }

  const sent = await sendResendReactEmail({
    context: "auth-forgot-password",
    intendedTo: normalizedAccount,
    subject: `Réinitialisez votre mot de passe · ${normalizedAccount}`,
    template: PasswordResetEmail,
    props: {
      name,
      accountEmail: normalizedAccount,
      resetUrl,
      portal,
    },
  })

  if (!sent.ok) {
    console.error("[auth-forgot-password]", {
      result: "email_failed",
      accountEmail: maskEmailForLog(normalizedAccount),
      error: sent.error,
    })
    return { ok: false, error: sent.error }
  }

  return { ok: true }
}
