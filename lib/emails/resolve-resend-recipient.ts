import { maskEmailForLog } from "@/lib/emails/mask-email"

type ResolveResendRecipientInput = {
  /** Real recipient (customer, account email, etc.). */
  intendedTo: string
  fromEmail: string
  testEmailTo: string
}

export type ResolveResendRecipientResult = {
  to: string
  /** True when dev sandbox redirects to TEST_EMAIL_TO instead of intendedTo. */
  devRedirect: boolean
}

export function isResendSandboxFrom(fromEmail: string): boolean {
  return fromEmail.includes("onboarding@resend.dev")
}

/** True on Vercel production (or NODE_ENV=production outside Vercel). */
export function isProductionEmailDelivery(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "production") return true
  if (vercelEnv === "preview" || vercelEnv === "development") return false
  return process.env.NODE_ENV === "production"
}

/**
 * - Production → always intendedTo (never block; never require TEST_EMAIL_TO).
 * - Dev/preview + sandbox → TEST_EMAIL_TO if set, else intendedTo (Resend may reject).
 * - Dev/preview + verified domain → intendedTo.
 */
export function resolveResendRecipient({
  intendedTo,
  fromEmail,
  testEmailTo,
}: ResolveResendRecipientInput): ResolveResendRecipientResult {
  const normalized = intendedTo.trim().toLowerCase()
  if (!normalized.includes("@")) {
    throw new Error("invalid_recipient")
  }

  const sandbox = isResendSandboxFrom(fromEmail)
  const production = isProductionEmailDelivery()

  if (production) {
    if (sandbox) {
      console.warn("[resend]", {
        result: "sandbox_from_in_production",
        hint: "Set RESEND_FROM_EMAIL to your verified domain on Vercel (e.g. noreply@affisell.com)",
      })
    }
    return { to: normalized, devRedirect: false }
  }

  if (!sandbox) {
    return { to: normalized, devRedirect: false }
  }

  const testTo = testEmailTo.trim().toLowerCase()
  if (testTo) {
    return { to: testTo, devRedirect: true }
  }

  return { to: normalized, devRedirect: false }
}

export function logResendRecipient(
  context: string,
  intendedTo: string,
  result: ResolveResendRecipientResult
): void {
  console.log(`[${context}]`, {
    intendedTo: maskEmailForLog(intendedTo),
    recipient: maskEmailForLog(result.to),
    devRedirect: result.devRedirect,
    production: isProductionEmailDelivery(),
  })
}
