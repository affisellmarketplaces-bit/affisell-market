import type { ReactElement } from "react"
import { render } from "@react-email/render"
import { Resend } from "resend"

import {
  isProductionEmailDelivery,
  isResendSandboxFrom,
  logResendRecipient,
  resolveResendRecipient,
  type ResolveResendRecipientResult,
} from "@/lib/emails/resolve-resend-recipient"
import { readResendEnv } from "@/lib/env/resend"
import { maskEmailForLog } from "@/lib/emails/mask-email"

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

type ResendSendResult = {
  data: { id: string } | null
  /** `name` is Resend's error code (e.g. `invalid_idempotent_request`, `concurrent_idempotent_requests`). */
  error: { message: string; name?: string } | null
}

/** Replaces every e-mail address in a provider message before it reaches a log. */
export function redactEmails(text: string): string {
  return text.replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g, "[email]")
}

/**
 * Sends via Resend with sandbox-aware recipient resolution.
 * In local dev, if the first attempt fails (sandbox restriction), retries TEST_EMAIL_TO when set.
 */
export async function sendResendEmail(args: {
  context: string
  config: ResendDeliveryConfig
  intendedTo: string
  subject: string
  html: string
  replyTo?: string
  /**
   * Sent as Resend's `Idempotency-Key` on the first attempt: a replay with the same key within 24 h does not send the
   * e-mail again. Not used for the sandbox fallback (a different recipient is a different e-mail).
   */
  idempotencyKey?: string
}): Promise<{ ok: true; resendId?: string } | { ok: false; error: string; errorName?: string }> {
  const { context, config, intendedTo, subject, html, replyTo, idempotencyKey } = args
  const resend = new Resend(config.apiKey)

  let recipient: ResolveResendRecipientResult
  try {
    recipient = resolveResendDeliveryRecipient(context, intendedTo, config)
  } catch {
    return { ok: false, error: "invalid_recipient" }
  }

  const attempt = async (to: string, key?: string): Promise<ResendSendResult> => {
    const payload = {
      from: config.from,
      to,
      subject,
      html,
      ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {}),
    }
    const { data, error } = key ? await resend.emails.send(payload, { idempotencyKey: key }) : await resend.emails.send(payload)
    return { data: data ?? null, error: error ?? null }
  }

  let result = await attempt(recipient.to, idempotencyKey?.trim() || undefined)
  if (!result.error) {
    console.log(`[${context}]`, { result: "email_sent", resendId: result.data?.id })
    return { ok: true, resendId: result.data?.id }
  }

  const errMsg = result.error.message
  const testTo = config.testEmailTo.trim().toLowerCase()
  const canFallback =
    !isProductionEmailDelivery() &&
    isResendSandboxFrom(config.from) &&
    testTo.length > 0 &&
    recipient.to !== testTo

  if (canFallback) {
    console.warn(`[${context}]`, {
      result: "resend_retry_test_inbox",
      // Never the raw address nor the provider's text (Resend echoes recipients in its messages, lower-cased — which
      // GitHub's secret masking, an exact-match filter, would not catch).
      firstError: redactEmails(errMsg),
      intendedTo: maskEmailForLog(intendedTo),
    })
    result = await attempt(testTo)
    if (!result.error) {
      console.log(`[${context}]`, { result: "email_sent_test_inbox", resendId: result.data?.id })
      return { ok: true, resendId: result.data?.id }
    }
  }

  console.error(`[${context}]`, {
    result: "resend_error",
    message: redactEmails(result.error?.message ?? errMsg),
    sandbox: isResendSandboxFrom(config.from),
    production: isProductionEmailDelivery(),
  })
  const errorName = typeof result.error?.name === "string" ? result.error.name : undefined
  return { ok: false, error: result.error?.message ?? errMsg, ...(errorName ? { errorName } : {}) }
}

/** Renders a React Email component and sends it. */
export async function sendResendReactEmail<TProps>(args: {
  context: string
  intendedTo: string
  subject: string
  template: (props: TProps) => ReactElement
  props: TProps
}): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error(`[${args.context}]`, { result: "no_resend_key" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const html = await render(args.template(args.props))
  return sendResendEmail({
    context: args.context,
    config,
    intendedTo: args.intendedTo,
    subject: args.subject,
    html,
  })
}
