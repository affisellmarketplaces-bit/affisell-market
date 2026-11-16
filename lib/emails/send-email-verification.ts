import { PasswordResetEmail } from "@/emails/password-reset"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { emailVerificationEmailSubject, loadEmailVerificationEmailCopy } from "@/lib/emails/load-email-copy"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import type { AppLocale } from "@/lib/i18n-locale"

/** The verification link e-mail (lib/email-verification.server.ts). Reuses the password-reset layout. */
export async function sendEmailVerificationEmail({
  accountEmail,
  name,
  verifyUrl,
  locale,
}: {
  accountEmail: string
  name?: string | null
  verifyUrl: string
  locale?: AppLocale | string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = accountEmail.trim().toLowerCase()
  if (!normalized.includes("@")) return { ok: false, error: "invalid_account_email" }

  const resolvedLocale = resolveEmailLocale(locale)
  const sent = await sendResendReactEmail({
    context: "auth-email-verify",
    intendedTo: normalized,
    subject: emailVerificationEmailSubject(resolvedLocale, normalized),
    template: PasswordResetEmail,
    props: {
      accountEmail: normalized,
      resetUrl: verifyUrl,
      copy: loadEmailVerificationEmailCopy(resolvedLocale, { name, accountEmail: normalized }),
    },
  })
  if (!sent.ok) {
    console.error("[auth-email-verify]", {
      result: "email_failed",
      accountEmail: maskEmailForLog(normalized),
      error: sent.error,
    })
    return { ok: false, error: sent.error }
  }
  return { ok: true }
}
