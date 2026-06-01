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
  error: { message: string } | null
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
}): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const { context, config, intendedTo, subject, html, replyTo } = args
  const resend = new Resend(config.apiKey)

  let recipient: ResolveResendRecipientResult
  try {
    recipient = resolveResendDeliveryRecipient(context, intendedTo, config)
  } catch {
    return { ok: false, error: "invalid_recipient" }
  }

  const attempt = async (to: string): Promise<ResendSendResult> => {
    const { data, error } = await resend.emails.send({
      from: config.from,
      to,
      subject,
      html,
      ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {}),
    })
    return { data: data ?? null, error: error ?? null }
  }

  let result = await attempt(recipient.to)
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
      firstError: errMsg,
      intendedTo: intendedTo.trim().toLowerCase(),
    })
    result = await attempt(testTo)
    if (!result.error) {
      console.log(`[${context}]`, { result: "email_sent_test_inbox", resendId: result.data?.id })
      return { ok: true, resendId: result.data?.id }
    }
  }

  console.error(`[${context}]`, {
    result: "resend_error",
    message: result.error?.message ?? errMsg,
    sandbox: isResendSandboxFrom(config.from),
    production: isProductionEmailDelivery(),
  })
  return { ok: false, error: result.error?.message ?? errMsg }
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
