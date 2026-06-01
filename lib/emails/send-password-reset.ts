import { render } from "@react-email/render"
import { Resend } from "resend"

import {
  PasswordResetEmail,
  type PasswordResetPortal,
} from "@/emails/password-reset"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import {
  logResendRecipient,
  resolveResendRecipient,
} from "@/lib/emails/resolve-resend-recipient"
import { readResendEnv } from "@/lib/env/resend"

export async function sendPasswordResetEmail({
  accountEmail,
  name,
  resetUrl,
  portal = null,
}: {
  /** Email stored on the user row — always the logical recipient. */
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

  const { apiKey, fromEmail, testEmailTo } = readResendEnv()
  if (!apiKey) {
    console.error("[auth-forgot-password]", { result: "no_resend_key" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const FROM = fromEmail || "Affisell <onboarding@resend.dev>"

  let recipient: string
  let devRedirect = false
  try {
    const resolved = resolveResendRecipient({
      accountEmail: normalizedAccount,
      fromEmail: FROM,
      testEmailTo,
    })
    recipient = resolved.to
    devRedirect = resolved.devRedirect
    logResendRecipient("auth-forgot-password", normalizedAccount, resolved)
  } catch {
    console.error("[auth-forgot-password]", {
      result: "skipped",
      reason: "TEST_EMAIL_TO required with onboarding@resend.dev",
      accountEmail: maskEmailForLog(normalizedAccount),
    })
    return { ok: false, error: "TEST_EMAIL_TO required" }
  }

  const html = await render(
    PasswordResetEmail({
      name,
      accountEmail: normalizedAccount,
      resetUrl,
      portal,
    })
  )

  const subject = `Réinitialisez votre mot de passe · ${normalizedAccount}`

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: recipient,
    subject,
    html,
    ...(devRedirect
      ? {
          headers: {
            "X-Affisell-Account-Email": normalizedAccount,
          },
        }
      : {}),
  })

  if (error) {
    console.error("[auth-forgot-password]", {
      result: "resend_error",
      accountEmail: maskEmailForLog(normalizedAccount),
      message: error.message,
    })
    return { ok: false, error: error.message }
  }

  console.log("[auth-forgot-password]", {
    result: "email_sent",
    accountEmail: maskEmailForLog(normalizedAccount),
    resendId: data?.id,
    devRedirect,
  })

  return { ok: true }
}
