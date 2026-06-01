import { maskEmailForLog } from "@/lib/emails/mask-email"

type ResolveResendRecipientInput = {
  /** Email stored on the user account (canonical recipient in production). */
  accountEmail: string
  fromEmail: string
  testEmailTo: string
}

export type ResolveResendRecipientResult = {
  to: string
  /** True when Resend sandbox redirects away from accountEmail. */
  devRedirect: boolean
}

/**
 * Production (verified domain): sends to accountEmail.
 * Resend sandbox (onboarding@resend.dev): redirects to TEST_EMAIL_TO.
 */
export function resolveResendRecipient({
  accountEmail,
  fromEmail,
  testEmailTo,
}: ResolveResendRecipientInput): ResolveResendRecipientResult {
  const normalized = accountEmail.trim().toLowerCase()
  const isSandbox = fromEmail.includes("onboarding@resend.dev")

  if (!isSandbox) {
    return { to: normalized, devRedirect: false }
  }

  if (!testEmailTo.trim()) {
    throw new Error("TEST_EMAIL_TO required")
  }

  return { to: testEmailTo.trim().toLowerCase(), devRedirect: true }
}

export function logResendRecipient(context: string, accountEmail: string, result: ResolveResendRecipientResult): void {
  console.log(`[${context}]`, {
    accountEmail: maskEmailForLog(accountEmail),
    recipient: maskEmailForLog(result.to),
    devRedirect: result.devRedirect,
  })
}
