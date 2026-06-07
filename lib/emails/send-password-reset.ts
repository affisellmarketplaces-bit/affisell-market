import {
  PasswordResetEmail,
  type PasswordResetPortal,
} from "@/emails/password-reset"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import {
  loadPasswordResetEmailCopy,
  passwordResetEmailSubject,
} from "@/lib/emails/load-email-copy"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import type { AppLocale } from "@/lib/i18n-locale"

export async function sendPasswordResetEmail({
  accountEmail,
  name,
  resetUrl,
  portal = null,
  locale,
}: {
  accountEmail: string
  name?: string | null
  resetUrl: string
  portal?: PasswordResetPortal
  locale?: AppLocale | string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedAccount = accountEmail.trim().toLowerCase()
  if (!normalizedAccount.includes("@")) {
    console.error("[auth-forgot-password]", { result: "invalid_account_email" })
    return { ok: false, error: "invalid_account_email" }
  }

  const resolvedLocale = resolveEmailLocale(locale)
  const copy = loadPasswordResetEmailCopy(resolvedLocale, {
    name,
    accountEmail: normalizedAccount,
    portal,
  })

  const sent = await sendResendReactEmail({
    context: "auth-forgot-password",
    intendedTo: normalizedAccount,
    subject: passwordResetEmailSubject(resolvedLocale, normalizedAccount),
    template: PasswordResetEmail,
    props: {
      accountEmail: normalizedAccount,
      resetUrl,
      copy,
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
