import {
  isResendSandboxFrom,
  logResendRecipient,
  resolveResendRecipient,
  type ResolveResendRecipientResult,
} from "@/lib/emails/resolve-resend-recipient"
import { readResendEnv } from "@/lib/env/resend"

export type ResendDeliveryConfig = {
  apiKey: string
  from: string
  testEmailTo: string
}

export function readResendDeliveryConfig(): ResendDeliveryConfig | null {
  const { apiKey, fromEmail, testEmailTo } = readResendEnv()
  if (!apiKey?.trim()) return null
  const from = fromEmail?.trim() || "Affisell <onboarding@resend.dev>"
  return { apiKey: apiKey.trim(), from, testEmailTo }
}

/**
 * Resolves the Resend `to` address. In production always the real recipient.
 * In local dev with sandbox FROM, uses TEST_EMAIL_TO.
 */
export function resolveResendDeliveryRecipient(
  context: string,
  intendedTo: string,
  config: ResendDeliveryConfig
): ResolveResendRecipientResult {
  const result = resolveResendRecipient({
    intendedTo,
    fromEmail: config.from,
    testEmailTo: config.testEmailTo,
  })
  logResendRecipient(context, intendedTo, result)
  return result
}

export function resendSandboxNeedsTestInbox(config: ResendDeliveryConfig): boolean {
  return isResendSandboxFrom(config.from) && !config.testEmailTo.trim()
}
